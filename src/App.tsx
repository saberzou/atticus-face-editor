import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Play, Pause, Square, Save, FolderOpen, Upload, Code2, Braces, Copy, X, Plus, Trash2, Diamond, ChevronDown, Grid3x3, FlipHorizontal2 } from 'lucide-react'
import { Button, Slider, Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './lib/ui'
import { cn, uid } from './lib/util'
import {
  type FaceDoc, type Expression, type FaceElement, type Kind,
  LCD_W, LCD_H, DEFAULT_COLORS, seedDoc, drawDoc, hitTest, generateC, elemAt,
} from './lib/face'

const STORAGE_KEY = 'atticus-face-studio-v3'

// Grid configuration: 64 cols × 48 rows over 320×240 face = 5px per cell.
const GRID_COLS = 64
const GRID_ROWS = 48
const CELL_W = LCD_W / GRID_COLS // 5
const CELL_H = LCD_H / GRID_ROWS // 5

const snap = (v: number, cell: number) => Math.round(v / cell) * cell
const snapX = (v: number) => snap(v, CELL_W)
const snapY = (v: number) => snap(v, CELL_H)
const mirrorXcenter = (cx: number) => LCD_W - cx
const mirrorXrect = (x: number, w: number) => LCD_W - x - w

function findMirrorRole(role: string): string | null {
  if (role.startsWith('left')) return 'right' + role.slice(4)
  if (role.startsWith('right')) return 'left' + role.slice(5)
  return null
}

/* ============================================================
 * NumberField: tap-to-type fallback for sub-cell precision
 * ============================================================ */
function NumberField({
  value, min, max, step = 1, onChange, className,
}: { value: number; min: number; max: number; step?: number; onChange: (n: number) => void; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(Math.round(value)))
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!editing) setDraft(String(Math.round(value))) }, [value, editing])
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select() } }, [editing])

  const commit = () => {
    const n = parseFloat(draft)
    if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)))
    setEditing(false)
  }
  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        inputMode="numeric"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          else if (e.key === 'Escape') { setDraft(String(Math.round(value))); setEditing(false) }
        }}
        className={cn('h-11 md:h-10 w-full rounded-md bg-surface border border-orange px-2 text-right font-mono text-base md:text-xs text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-orange', className)}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn('h-11 md:h-9 w-full rounded-md bg-surface/60 border border-line px-2 text-right font-mono text-xs text-ink-dim hover:border-orange hover:text-ink transition-colors', className)}
      title="Tap to type exact value"
    >
      {Math.round(value)}
    </button>
  )
}

/* ============================================================
 * GridStage — the new canvas.
 * - 64×48 grid overlay (toggleable)
 * - Tap to select / drag to move (snapped)
 * - Corner handles to resize (snapped)
 * - Symmetry mirrors edits across vertical centerline
 * - Long-press on empty grid places currently-selected part type
 * ============================================================ */

type HandleKind = 'move' | 'nw' | 'ne' | 'sw' | 'se'

function getElementBounds(el: FaceElement, t: number) {
  const e = elemAt(el, t)
  if (e.kind === 'ellipse') {
    const rx = (e.w ?? 0) / 2, ry = (e.h ?? 0) / 2
    return { x: e.x - rx, y: e.y - ry, w: e.w ?? 0, h: e.h ?? 0, cx: e.x, cy: e.y }
  }
  if (e.kind === 'rect') {
    return { x: e.x, y: e.y, w: e.w ?? 0, h: e.h ?? 0, cx: e.x + (e.w ?? 0) / 2, cy: e.y + (e.h ?? 0) / 2 }
  }
  // arc — bounded by 2r square centered at e.x,e.y
  const r = e.r ?? 0
  return { x: e.x - r, y: e.y - r, w: r * 2, h: r * 2, cx: e.x, cy: e.y }
}

function GridStage({
  doc, expr, t, selectionId, showGrid, symmetry,
  onSelect, onMoveElem, onResizeElem, onPlace, placingKind,
}: {
  doc: FaceDoc
  expr: Expression | undefined
  t: number
  selectionId: string | null
  showGrid: boolean
  symmetry: boolean
  onSelect: (id: string | null) => void
  onMoveElem: (id: string, dx: number, dy: number) => void
  onResizeElem: (id: string, handle: HandleKind, x: number, y: number) => void
  onPlace: (kind: Kind, x: number, y: number) => void
  placingKind: Kind | null
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ id: string; kind: HandleKind; startX: number; startY: number; lastX: number; lastY: number } | null>(null)
  const [size, setSize] = useState({ w: 320, h: 240 })

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return
      const r = wrapRef.current.getBoundingClientRect()
      setSize({ w: Math.max(80, Math.round(r.width)), h: Math.max(60, Math.round(r.height)) })
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size.w * dpr
    canvas.height = size.h * dpr
    const ctx = canvas.getContext('2d')!
    drawDoc(ctx, canvas.width, canvas.height, doc, expr, t, null, false)

    if (showGrid) {
      const sx = canvas.width / LCD_W, sy = canvas.height / LCD_H
      ctx.strokeStyle = 'rgba(255,138,43,0.10)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let c = 0; c <= GRID_COLS; c++) {
        const x = Math.round(c * CELL_W * sx) + 0.5
        ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height)
      }
      for (let r = 0; r <= GRID_ROWS; r++) {
        const y = Math.round(r * CELL_H * sy) + 0.5
        ctx.moveTo(0, y); ctx.lineTo(canvas.width, y)
      }
      ctx.stroke()
      // centerline accent (symmetry axis)
      ctx.strokeStyle = 'rgba(255,138,43,0.32)'
      ctx.lineWidth = 1
      ctx.beginPath()
      const cx = Math.round((LCD_W / 2) * sx) + 0.5
      ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke()
    }

    // selection outline + handles (drawn last)
    if (selectionId && expr) {
      const el = expr.elements.find((x) => x.id === selectionId)
      if (el) {
        const b = getElementBounds(el, t)
        const sx = canvas.width / LCD_W, sy = canvas.height / LCD_H
        ctx.save()
        ctx.strokeStyle = '#ff8a2b'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        ctx.strokeRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy)
        ctx.setLineDash([])
        // handles
        const handleR = Math.max(7, 9 * Math.min(sx, sy))
        const drawHandle = (px: number, py: number) => {
          ctx.fillStyle = '#ff8a2b'
          ctx.strokeStyle = '#1a1a1a'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(px * sx, py * sy, handleR, 0, Math.PI * 2)
          ctx.fill(); ctx.stroke()
        }
        drawHandle(b.x, b.y)
        drawHandle(b.x + b.w, b.y)
        drawHandle(b.x, b.y + b.h)
        drawHandle(b.x + b.w, b.y + b.h)
        ctx.restore()
      }
    }
  }, [size, doc, expr, t, selectionId, showGrid])

  const eventToLcd = useCallback((ev: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: ((ev.clientX - rect.left) / rect.width) * LCD_W,
      y: ((ev.clientY - rect.top) / rect.height) * LCD_H,
    }
  }, [])

  // Detect which handle was tapped (if any) for selected element
  const handleHit = useCallback((p: { x: number; y: number }): HandleKind | null => {
    if (!selectionId || !expr) return null
    const el = expr.elements.find((x) => x.id === selectionId)
    if (!el) return null
    const b = getElementBounds(el, t)
    // 14px tolerance in LCD units = ~3 cells; generous for touch
    const tol = 14
    const near = (hx: number, hy: number) => Math.abs(p.x - hx) <= tol && Math.abs(p.y - hy) <= tol
    if (near(b.x, b.y)) return 'nw'
    if (near(b.x + b.w, b.y)) return 'ne'
    if (near(b.x, b.y + b.h)) return 'sw'
    if (near(b.x + b.w, b.y + b.h)) return 'se'
    return null
  }, [selectionId, expr, t])

  return (
    <div className="shrink-0 p-3 md:p-5 max-w-full overflow-hidden">
      <div
        ref={wrapRef}
        className="relative mx-auto bg-black rounded-2xl shadow-stage w-full max-w-[640px] aspect-[4/3]"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full rounded-2xl block"
          style={{ imageRendering: 'pixelated', touchAction: 'none' }}
          onPointerDown={(ev) => {
            (ev.target as Element).setPointerCapture(ev.pointerId)
            const p = eventToLcd(ev)
            // 1) Handle hit takes priority
            const h = handleHit(p)
            if (h) {
              dragRef.current = { id: selectionId!, kind: h, startX: p.x, startY: p.y, lastX: p.x, lastY: p.y }
              return
            }
            // 2) Element hit → select + start move drag
            const hit = expr ? hitTest(expr, p, t) : null
            if (hit) {
              onSelect(hit.id)
              dragRef.current = { id: hit.id, kind: 'move', startX: p.x, startY: p.y, lastX: p.x, lastY: p.y }
              return
            }
            // 3) Empty: if a placingKind is armed, place it (snapped). Otherwise deselect.
            if (placingKind) {
              onPlace(placingKind, snapX(p.x), snapY(p.y))
            } else {
              onSelect(null)
            }
            dragRef.current = null
          }}
          onPointerMove={(ev) => {
            const d = dragRef.current
            if (!d) return
            const p = eventToLcd(ev)
            if (d.kind === 'move') {
              const dx = snapX(p.x) - snapX(d.lastX)
              const dy = snapY(p.y) - snapY(d.lastY)
              if (dx !== 0 || dy !== 0) {
                onMoveElem(d.id, dx, dy)
                d.lastX += dx; d.lastY += dy
              }
            } else {
              onResizeElem(d.id, d.kind, snapX(p.x), snapY(p.y))
            }
          }}
          onPointerUp={() => { dragRef.current = null }}
          onPointerCancel={() => { dragRef.current = null }}
        />
        {/* Visible hint for armed placement */}
        {placingKind && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-orange/90 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-ink-deep shadow-glow">
            tap to place {placingKind}
          </div>
        )}
        {symmetry && (
          <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-surface/80 backdrop-blur px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-orange ring-1 ring-orange/40">
            symmetry on
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
 * Expression thumbnail (used in switcher)
 * ============================================================ */
function ExprThumb({ doc, expr, w, h }: { doc: FaceDoc; expr: Expression; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const dpr = window.devicePixelRatio || 1
    ref.current.width = w * dpr
    ref.current.height = h * dpr
    const ctx = ref.current.getContext('2d')!
    drawDoc(ctx, ref.current.width, ref.current.height, doc, expr, 0, null, false)
  }, [doc, expr, w, h])
  return <canvas ref={ref} className="rounded-md bg-black ring-1 ring-line" style={{ width: w, height: h, imageRendering: 'pixelated' }} />
}

/* ============================================================
 * Expression switcher
 * ============================================================ */
function ExpressionSwitcher({
  doc, activeId, onSelect, onAdd,
}: { doc: FaceDoc; activeId: string; onSelect: (id: string) => void; onAdd: () => void }) {
  return (
    <div className="shrink-0">
      <div className="flex gap-2 overflow-x-auto px-3 py-2.5 md:px-5 snap-x snap-mandatory">
        {doc.expressions.map((ex) => {
          const isActive = ex.id === activeId
          const hasAnim = ex.duration > 0 && ex.elements.some((el) => Object.keys(el.keyframes || {}).length > 0)
          return (
            <button
              key={ex.id}
              onClick={() => onSelect(ex.id)}
              className={cn(
                'group relative shrink-0 snap-start rounded-lg p-1.5 transition-all min-h-11',
                isActive ? 'bg-gradient-to-br from-[oklch(0.22_0.05_55)] to-surface shadow-glow ring-1 ring-orange' : 'bg-surface hover:bg-surface-2',
              )}
            >
              <div className="flex items-center gap-2">
                <ExprThumb doc={doc} expr={ex} w={48} h={36} />
                <div className="pr-1.5 text-left min-w-0">
                  <div className={cn('text-[12px] leading-tight font-medium truncate max-w-[7rem]', isActive ? 'text-ink' : 'text-ink-dim group-hover:text-ink')}>{ex.name}</div>
                  <div className="font-mono text-[9px] text-ink-faint">
                    {ex.elements.length}p{hasAnim && <span className="text-good"> · anim</span>}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
        <button
          onClick={onAdd}
          className="shrink-0 snap-start min-w-[3rem] flex items-center justify-center rounded-lg border border-dashed border-line text-ink-faint hover:border-orange hover:text-ink hover:bg-surface transition-all px-3"
          aria-label="new expression"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/* ============================================================
 * Parts list (replaces slider-heavy inspector)
 * - Tap row → select on canvas
 * - Expand → name, color, delete, keyframe tracks
 * - No spatial sliders (those are on canvas now)
 * - Keyframe tracks remain (animation is timing data, not spatial)
 * ============================================================ */
function PartsList({
  expr, activeElemId, playT,
  onSelect, onDelete,
  onColor, onRename, onToggleKf,
  onClearTrack, onSetKfValue, onSetKfTime, onRemoveKf,
}: {
  expr: Expression | undefined
  activeElemId: string | null
  playT: number
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
  onColor: (c: string) => void
  onRename: (n: string) => void
  onToggleKf: (prop: string) => void
  onClearTrack: (prop: string) => void
  onSetKfValue: (prop: string, i: number, v: any) => void
  onSetKfTime: (prop: string, i: number, t: number) => void
  onRemoveKf: (prop: string, i: number) => void
}) {
  if (!expr) return null
  return (
    <div className="p-3 md:p-4 space-y-3">
      {expr.elements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line py-8 text-center text-ink-faint">
          <div className="font-display text-xl italic text-ink-dim">Empty face</div>
          <div className="text-sm mt-1">Pick a part type below the canvas and tap to place.</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {expr.elements.map((el) => {
            const isActive = el.id === activeElemId
            return (
              <PartRow
                key={el.id}
                el={el}
                isActive={isActive}
                playT={playT}
                onSelect={() => onSelect(isActive ? null : el.id)}
                onDelete={() => onDelete(el.id)}
                onColor={onColor}
                onRename={onRename}
                onToggleKf={onToggleKf}
                onClearTrack={onClearTrack}
                onSetKfValue={onSetKfValue}
                onSetKfTime={onSetKfTime}
                onRemoveKf={onRemoveKf}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function PartRow({
  el, isActive, playT,
  onSelect, onDelete, onColor, onRename, onToggleKf,
  onClearTrack, onSetKfValue, onSetKfTime, onRemoveKf,
}: {
  el: FaceElement; isActive: boolean; playT: number
  onSelect: () => void; onDelete: () => void
  onColor: (c: string) => void; onRename: (n: string) => void
  onToggleKf: (p: string) => void; onClearTrack: (p: string) => void
  onSetKfValue: (p: string, i: number, v: any) => void
  onSetKfTime: (p: string, i: number, t: number) => void
  onRemoveKf: (p: string, i: number) => void
}) {
  // Properties that make sense to keyframe per kind (spatial values are still keyframeable,
  // but you set the value on canvas, then hit the diamond to record at playhead.)
  const kfProps: Record<Kind, string[]> = {
    ellipse: ['x', 'y', 'w', 'h'],
    rect: ['x', 'y', 'w', 'h'],
    arc: ['x', 'y', 'r', 'thick', 'start', 'end'],
  }
  const hasKf = Object.keys(el.keyframes || {}).length > 0
  const hasColorKf = !!el.keyframes?.color?.length
  const tracks = Object.keys(el.keyframes || {}).filter((k) => el.keyframes[k].length > 0)

  return (
    <div className={cn('rounded-lg transition-all overflow-hidden', isActive ? 'border border-orange bg-bg/40 shadow-glow' : 'bg-surface/30 hover:bg-surface/60')}>
      <button
        onClick={onSelect}
        className="flex w-full items-center gap-2.5 px-3 py-3 text-left min-h-11"
      >
        <span className="h-4 w-4 shrink-0 rounded ring-1 ring-black/40" style={{ background: el.color }} />
        <span className="flex-1 truncate text-[13px] font-medium">{el.name || el.kind}</span>
        {hasKf && <Diamond className="h-3 w-3 text-good shrink-0" fill="currentColor" />}
        <span className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">{el.kind}</span>
        <ChevronDown className={cn('h-4 w-4 text-ink-faint transition-transform shrink-0', isActive && 'rotate-180')} />
      </button>

      {isActive && (
        <div className="bg-bg-deep/40 px-3 py-3 space-y-3">
          {/* name + color + delete */}
          <div className="grid grid-cols-[1fr_2.5rem_2.5rem] gap-2 items-center">
            <input
              type="text"
              value={el.name}
              onChange={(e) => onRename(e.target.value)}
              placeholder="Name"
              className="h-11 md:h-9 rounded-md bg-surface border border-line px-3 text-base md:text-sm text-ink focus:border-orange focus:outline-none"
            />
            <div className="relative h-11 md:h-9">
              <input
                type="color"
                value={el.color}
                onChange={(e) => onColor(e.target.value)}
                className="absolute inset-0 cursor-pointer rounded-md border border-line bg-surface p-1 w-full h-full"
                aria-label="color"
              />
            </div>
            <button
              onClick={onDelete}
              className="h-11 md:h-9 rounded-md border border-line text-ink-faint hover:border-bad hover:text-bad transition-colors"
              aria-label="delete part"
            >
              <Trash2 className="h-4 w-4 mx-auto" />
            </button>
          </div>

          {/* keyframe-at-playhead row */}
          <div className="rounded-md border border-line bg-surface/40 p-2.5 space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">Animate at playhead</div>
            <div className="flex flex-wrap gap-1.5">
              {kfProps[el.kind].map((p) => {
                const has = !!el.keyframes?.[p]?.length
                return (
                  <button
                    key={p}
                    onClick={() => onToggleKf(p)}
                    title={has ? `${p} has keyframes — set at playhead` : `set ${p} keyframe at playhead`}
                    className={cn(
                      'flex items-center gap-1 h-9 px-2.5 rounded-md border text-[11px] font-mono uppercase tracking-wider transition-all',
                      has ? 'bg-good/20 border-good/60 text-good' : 'border-line text-ink-faint hover:border-orange hover:text-orange',
                    )}
                  >
                    <Diamond className="h-3 w-3" fill={has ? 'currentColor' : 'none'} /> {p}
                  </button>
                )
              })}
              <button
                onClick={() => onToggleKf('color')}
                title={hasColorKf ? 'color has keyframes' : 'set color keyframe at playhead'}
                className={cn(
                  'flex items-center gap-1 h-9 px-2.5 rounded-md border text-[11px] font-mono uppercase tracking-wider transition-all',
                  hasColorKf ? 'bg-good/20 border-good/60 text-good' : 'border-line text-ink-faint hover:border-orange hover:text-orange',
                )}
              >
                <Diamond className="h-3 w-3" fill={hasColorKf ? 'currentColor' : 'none'} /> color
              </button>
            </div>
          </div>

          {tracks.length > 0 && (
            <div className="border-t border-dashed border-line pt-3 space-y-3">
              {tracks.map((k) => (
                <div key={k}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-good">
                      <Diamond className="h-3 w-3" fill="currentColor" /> {k} track
                    </div>
                    <button onClick={() => onClearTrack(k)} className="text-[10px] uppercase tracking-wider text-ink-faint hover:text-bad">clear</button>
                  </div>
                  <div className="space-y-1">
                    {el.keyframes[k].map((kf, i) => {
                      const isColor = typeof kf.v === 'string'
                      return (
                        <div key={i} className="grid grid-cols-[4rem_1fr_1.75rem] items-center gap-1.5">
                          <NumberField value={kf.t} min={0} max={60000} step={10} onChange={(tt) => onSetKfTime(k, i, tt)} className="text-orange" />
                          {isColor ? (
                            <input
                              type="color"
                              value={kf.v as string}
                              onChange={(e) => onSetKfValue(k, i, e.target.value)}
                              className="h-8 w-full cursor-pointer rounded-md bg-surface border border-line p-1"
                            />
                          ) : (
                            <NumberField value={kf.v as number} min={-1000} max={2000} onChange={(n) => onSetKfValue(k, i, n)} />
                          )}
                          <button onClick={() => onRemoveKf(k, i)} className="text-ink-faint hover:text-bad h-8">
                            <X className="h-4 w-4 mx-auto" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ============================================================
 * Expression meta
 * ============================================================ */
function ExpressionMeta({
  expr, onMutate, onSelect, onDelete,
}: { expr: Expression | undefined; onMutate: (key: 'id' | 'name' | 'duration', v: any) => void; onSelect: (id: string) => void; onDelete: () => void }) {
  if (!expr) return null
  return (
    <div className="p-3 md:p-4 space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Expression</span>
        <span className="font-display text-lg italic text-orange truncate max-w-[60%]">{expr.name}</span>
      </div>
      <div className="grid grid-cols-[3.5rem_1fr] gap-2 items-center">
        <label className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">Name</label>
        <input
          type="text"
          value={expr.name}
          onChange={(e) => onMutate('name', e.target.value)}
          className="h-11 md:h-9 rounded-md bg-surface border border-line px-3 text-base md:text-sm text-ink focus:border-orange focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-[3.5rem_1fr] gap-2 items-center">
        <label className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">ID</label>
        <input
          type="text"
          value={expr.id}
          onChange={(e) => onMutate('id', e.target.value)}
          className="h-11 md:h-9 rounded-md bg-surface border border-line px-3 text-base md:text-sm text-ink font-mono focus:border-orange focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-[3.5rem_1fr_4rem] gap-2 items-center">
        <label className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">Loop</label>
        <Slider min={0} max={10000} step={100} value={[expr.duration]} onValueChange={(v) => onMutate('duration', v[0])} />
        <NumberField value={expr.duration} min={0} max={60000} step={100} onChange={(n) => onMutate('duration', n)} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline" size="sm" className="flex-1"
          onClick={() => {
            const c = structuredClone(expr)
            c.id = expr.id + '-copy'; c.name = expr.name + ' copy'
            c.elements.forEach((el) => { el.id = uid() })
            const ev = new CustomEvent('atticus:duplicate-expr', { detail: c })
            window.dispatchEvent(ev)
            onSelect(c.id)
          }}
        >Duplicate</Button>
        <Button
          variant="outline" size="sm" className="flex-1 hover:!border-bad hover:!text-bad"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" /> Delete
        </Button>
      </div>
    </div>
  )
}

/* ============================================================
 * Toast
 * ============================================================ */
function useToasts() {
  const [list, setList] = useState<{ id: string; msg: string }[]>([])
  const toast = (msg: string) => {
    const id = uid()
    setList((l) => [...l, { id, msg }])
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 1600)
  }
  const node = (
    <div className="pointer-events-none fixed left-1/2 top-20 z-[100] -translate-x-1/2 space-y-2 md:bottom-6 md:top-auto">
      {list.map((t) => (
        <div key={t.id} className="rounded-full bg-orange px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink-deep shadow-[0_8px_24px_rgba(0,0,0,0.4)]" style={{ animation: 'toastIn .25s ease-out' }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
  return { toast, node }
}

/* ============================================================
 * App
 * ============================================================ */
export default function App() {
  const [doc, setDoc] = useState<FaceDoc>(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const p = JSON.parse(raw); if (p?.expressions?.length && (p.version ?? 0) >= 4) return p } } catch {}
    return seedDoc()
  })
  const [activeExprId, setActiveExprId] = useState(doc.expressions[0].id)
  const [activeElemId, setActiveElemId] = useState<string | null>(null)
  const [placingKind, setPlacingKind] = useState<Kind | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [symmetry, setSymmetry] = useState(true)

  const [playing, setPlaying] = useState(false)
  const [playT, setPlayT] = useState(0)
  const playStartRef = useRef(0)

  const [exportOpen, setExportOpen] = useState<null | 'json' | 'c'>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')

  const [liveOn, setLiveOn] = useState(false)
  const [liveCfg, setLiveCfg] = useState<{ url: string; token: string } | null>(null)
  const pushRef = useRef<{ busy: boolean; pending: boolean }>({ busy: false, pending: false })

  const { toast, node: toastNode } = useToasts()

  const activeExpr = useMemo(() => doc.expressions.find((e) => e.id === activeExprId), [doc, activeExprId])
  const activeElem = useMemo(() => activeExpr?.elements.find((e) => e.id === activeElemId) ?? null, [activeExpr, activeElemId])

  const mutate = (fn: (d: FaceDoc) => void) => setDoc((prev) => { const next = structuredClone(prev) as FaceDoc; fn(next); return next })
  const mutateElem = (fn: (el: FaceElement) => void) => mutate((d) => { const ex = d.expressions.find((e) => e.id === activeExprId); const el = ex?.elements.find((e) => e.id === activeElemId); if (el) fn(el) })
  const mutateExpr = (fn: (ex: Expression) => void) => mutate((d) => { const ex = d.expressions.find((e) => e.id === activeExprId); if (ex) fn(ex) })

  // Resolve mirror partner element (by role) within current expr.
  const findMirrorElem = (ex: Expression, el: FaceElement): FaceElement | null => {
    const mirrorRole = findMirrorRole(el.role)
    if (!mirrorRole) return null
    return ex.elements.find((e) => e.role === mirrorRole && e.id !== el.id) ?? null
  }

  /* play loop */
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = (now: number) => {
      const d = activeExpr?.duration || 0
      if (d > 0) setPlayT(((now - playStartRef.current) % d))
      raf = requestAnimationFrame(tick)
    }
    playStartRef.current = performance.now() - playT
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, activeExpr?.duration])

  /* live mirror push */
  const pushLive = useCallback(async () => {
    if (!liveOn || !liveCfg) return
    if (pushRef.current.busy) { pushRef.current.pending = true; return }
    pushRef.current.busy = true
    try {
      await fetch(liveCfg.url + '/face', {
        method: 'POST',
        headers: { Authorization: '***' + liveCfg.token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression: activeExprId, t: playT, doc }),
      })
    } catch {}
    pushRef.current.busy = false
    if (pushRef.current.pending) { pushRef.current.pending = false; pushLive() }
  }, [liveOn, liveCfg, activeExprId, playT, doc])
  useEffect(() => { pushLive() }, [pushLive])

  /* keyboard nudges (1-cell steps; Shift = 4 cells) */
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tgt = ev.target as HTMLElement
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return
      if (!activeElem) return
      const sx = ev.shiftKey ? CELL_W * 4 : CELL_W
      const sy = ev.shiftKey ? CELL_H * 4 : CELL_H
      let handled = true
      if (ev.key === 'ArrowLeft') moveElem(activeElem.id, -sx, 0)
      else if (ev.key === 'ArrowRight') moveElem(activeElem.id, sx, 0)
      else if (ev.key === 'ArrowUp') moveElem(activeElem.id, 0, -sy)
      else if (ev.key === 'ArrowDown') moveElem(activeElem.id, 0, sy)
      else if (ev.key === 'Delete' || ev.key === 'Backspace') {
        deleteElement(activeElem.id)
      } else if (ev.key === 'Escape') {
        setPlacingKind(null); setActiveElemId(null)
      } else handled = false
      if (handled) ev.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeElem, activeExprId, symmetry])

  /* listen for duplicate-expr event */
  useEffect(() => {
    const onDup = (e: any) => mutate((d) => d.expressions.push(e.detail))
    window.addEventListener('atticus:duplicate-expr', onDup)
    return () => window.removeEventListener('atticus:duplicate-expr', onDup)
  }, [])

  const addExpression = () => {
    const id = prompt('Expression id (lowercase, no spaces):', 'new_expr')?.trim()
    if (!id) return
    if (doc.expressions.find((e) => e.id === id)) { toast('id exists'); return }
    mutate((d) => d.expressions.push({ id, name: id, duration: 0, elements: [] }))
    setActiveExprId(id); setActiveElemId(null)
  }

  // Place a new part snapped at (x,y). Sets reasonable default size in cells.
  // If symmetry is on AND we're placing the first ellipse pair, tag as leftEye so
  // mirror partner becomes rightEye and future moves stay synced by role.
  const placeElement = (kind: Kind, x: number, y: number) => {
    const id = uid()
    const isFirstEyePair = kind === 'ellipse' && !!activeExpr && !activeExpr.elements.some((e) => e.role === 'leftEye' || e.role === 'rightEye')
    const role = isFirstEyePair ? 'leftEye' : kind
    // Default sizes in grid cells:
    const dEll = { w: CELL_W * 12, h: CELL_W * 12 } // 60×60
    const dRect = { w: CELL_W * 10, h: CELL_H * 2 } // 50×10 (closed eye / brow bar)
    const dArc = { r: CELL_W * 6, thick: 5, start: 0, end: 180 } // r=30

    const base: FaceElement = { id, role, name: role[0].toUpperCase() + role.slice(1), kind, color: DEFAULT_COLORS.EYE, keyframes: {}, x, y }
    if (kind === 'ellipse') Object.assign(base, dEll)
    else if (kind === 'rect') Object.assign(base, dRect)
    else if (kind === 'arc') Object.assign(base, dArc)

    mutate((d) => {
      const ex = d.expressions.find((e) => e.id === activeExprId)
      if (!ex) return
      ex.elements.push(base)
      // Mirror placement for eye/brow if symmetry on and we used left*/right* naming
      if (symmetry && (base.role === 'leftEye' || base.role === 'leftBrow')) {
        const m = structuredClone(base) as FaceElement
        m.id = uid()
        m.role = base.role.startsWith('left') ? 'right' + base.role.slice(4) : base.role
        m.name = m.role[0].toUpperCase() + m.role.slice(1)
        if (kind === 'rect') m.x = mirrorXrect(base.x, base.w ?? 0)
        else m.x = mirrorXcenter(base.x)
        ex.elements.push(m)
      }
    })
    setActiveElemId(id)
    setPlacingKind(null)
  }

  // Move element by (dx, dy) in LCD units. Mirrors partner when symmetry on.
  const moveElem = (id: string, dx: number, dy: number) => {
    mutate((d) => {
      const ex = d.expressions.find((e) => e.id === activeExprId)
      if (!ex) return
      const el = ex.elements.find((e) => e.id === id)
      if (!el) return
      el.x = snapX(Math.max(0, Math.min(LCD_W, el.x + dx)))
      el.y = snapY(Math.max(0, Math.min(LCD_H, el.y + dy)))
      if (symmetry) {
        const m = findMirrorElem(ex, el)
        if (m) {
          // Mirror x; keep y in sync; same size kept (no size change here)
          if (el.kind === 'rect') m.x = snapX(mirrorXrect(el.x, el.w ?? 0))
          else m.x = snapX(mirrorXcenter(el.x))
          m.y = el.y
        }
      }
    })
  }

  // Resize via corner handle. For ellipse/arc (center-origin), we resize symmetrically
  // around center using the distance from center to the dragged handle.
  // For rect (top-left origin), we resize from the opposite corner.
  const resizeElem = (id: string, handle: HandleKind, x: number, y: number) => {
    mutate((d) => {
      const ex = d.expressions.find((e) => e.id === activeExprId)
      if (!ex) return
      const el = ex.elements.find((e) => e.id === id)
      if (!el) return
      const px = snapX(Math.max(0, Math.min(LCD_W, x)))
      const py = snapY(Math.max(0, Math.min(LCD_H, y)))

      if (el.kind === 'ellipse') {
        const rx = Math.max(CELL_W, Math.abs(px - el.x))
        const ry = Math.max(CELL_H, Math.abs(py - el.y))
        el.w = rx * 2
        el.h = ry * 2
      } else if (el.kind === 'arc') {
        const r = Math.max(CELL_W, Math.round(Math.hypot(px - el.x, py - el.y)))
        el.r = r
      } else if (el.kind === 'rect') {
        // opposite corner anchor
        const anchor = {
          nw: { x: el.x + (el.w ?? 0), y: el.y + (el.h ?? 0) },
          ne: { x: el.x, y: el.y + (el.h ?? 0) },
          sw: { x: el.x + (el.w ?? 0), y: el.y },
          se: { x: el.x, y: el.y },
        }[handle === 'move' ? 'se' : handle]
        const nx = Math.min(anchor.x, px)
        const ny = Math.min(anchor.y, py)
        const nw = Math.max(CELL_W, Math.abs(anchor.x - px))
        const nh = Math.max(CELL_H, Math.abs(anchor.y - py))
        el.x = snapX(nx); el.y = snapY(ny); el.w = snapX(nw); el.h = snapY(nh)
      }

      if (symmetry) {
        const m = findMirrorElem(ex, el)
        if (m && m.kind === el.kind) {
          if (el.kind === 'ellipse' || el.kind === 'arc') {
            m.w = el.w; m.h = el.h; m.r = el.r
            m.x = snapX(mirrorXcenter(el.x)); m.y = el.y
          } else if (el.kind === 'rect') {
            m.w = el.w; m.h = el.h
            m.x = snapX(mirrorXrect(el.x, el.w ?? 0)); m.y = el.y
          }
        }
      }
    })
  }

  const deleteElement = (id: string) => {
    mutate((d) => {
      const ex = d.expressions.find((e) => e.id === activeExprId)
      if (!ex) return
      const el = ex.elements.find((e) => e.id === id)
      let toRemove = new Set<string>([id])
      if (symmetry && el) {
        const m = findMirrorElem(ex, el)
        if (m) toRemove.add(m.id)
      }
      ex.elements = ex.elements.filter((e) => !toRemove.has(e.id))
    })
    if (activeElemId === id) setActiveElemId(null)
  }

  const toggleKf = (prop: string) => {
    mutateElem((el) => {
      el.keyframes = el.keyframes || {}
      el.keyframes[prop] = el.keyframes[prop] || []
      const i = el.keyframes[prop].findIndex((k) => k.t === playT)
      const v = (el as any)[prop]
      if (i >= 0) el.keyframes[prop][i].v = v
      else el.keyframes[prop].push({ t: playT, v })
      el.keyframes[prop].sort((a, b) => a.t - b.t)
    })
    mutateExpr((ex) => { if (!ex.duration) ex.duration = 2000 })
  }

  const handleSave = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(doc)); toast('saved') }
  const handleLoad = () => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return toast('nothing saved')
    try { const p = JSON.parse(raw); if (!p?.expressions?.length) throw new Error(); setDoc(p); setActiveExprId(p.expressions[0].id); setActiveElemId(null); toast('loaded') } catch { toast('load failed') }
  }
  const handleImport = () => {
    try {
      const p = JSON.parse(importText)
      if (!p.expressions) throw new Error('Missing expressions')
      setDoc(p); setActiveExprId(p.expressions[0].id); setActiveElemId(null)
      setImportOpen(false); setImportText(''); toast('imported')
    } catch { toast('bad json') }
  }
  const exportText = exportOpen === 'json' ? JSON.stringify(doc, null, 2) : exportOpen === 'c' ? generateC(doc) : ''

  const handleLiveToggle = async () => {
    if (liveOn) { setLiveOn(false); setLiveCfg(null); return }
    const url = prompt('Bridge URL', liveCfg?.url ?? 'http://localhost:8770')?.trim()
    if (!url) return
    const token = prompt('Bearer token', liveCfg?.token ?? '')?.trim()
    if (!token) return
    const cfg = { url: url.replace(/\/$/, ''), token }
    try {
      const r = await fetch(cfg.url + '/healthz')
      if (!r.ok) throw new Error()
      setLiveCfg(cfg); setLiveOn(true); toast('connected')
    } catch { toast('connect failed') }
  }

  const handleDeleteExpr = () => {
    if (doc.expressions.length === 1) return toast('need at least one')
    if (!confirm(`Delete "${activeExpr?.name}"?`)) return
    const remaining = doc.expressions.filter((e) => e.id !== activeExprId)
    mutate((d) => { d.expressions = d.expressions.filter((e) => e.id !== activeExprId) })
    setActiveExprId(remaining[0].id); setActiveElemId(null)
  }

  const inspector = (
    <>
      <ExpressionMeta
        expr={activeExpr}
        onMutate={(k, v) => {
          mutate((d) => { const ex = d.expressions.find((x) => x.id === activeExprId); if (ex) (ex as any)[k] = v })
          if (k === 'id' && typeof v === 'string') setActiveExprId(v)
        }}
        onSelect={setActiveExprId}
        onDelete={handleDeleteExpr}
      />
      <PartsList
        expr={activeExpr}
        activeElemId={activeElemId}
        playT={playT}
        onSelect={setActiveElemId}
        onDelete={deleteElement}
        onColor={(c) => mutateElem((el) => { el.color = c })}
        onRename={(n) => mutateElem((el) => { el.name = n })}
        onToggleKf={toggleKf}
        onClearTrack={(p) => mutateElem((el) => { delete el.keyframes[p] })}
        onSetKfValue={(p, i, v) => mutateElem((el) => { if (el.keyframes[p]?.[i]) el.keyframes[p][i].v = v })}
        onSetKfTime={(p, i, t) => mutateElem((el) => { if (el.keyframes[p]?.[i]) { el.keyframes[p][i].t = t; el.keyframes[p].sort((a, b) => a.t - b.t) } })}
        onRemoveKf={(p, i) => mutateElem((el) => { el.keyframes[p].splice(i, 1); if (!el.keyframes[p].length) delete el.keyframes[p] })}
      />
    </>
  )

  // Reset state when expression changes
  const switchExpr = (id: string) => { setActiveExprId(id); setActiveElemId(null); setPlacingKind(null); setPlayT(0); setPlaying(false) }

  return (
    <div className="w-full max-w-[100vw] bg-bg md:flex md:h-[100dvh] md:flex-col md:overflow-hidden" style={{ minHeight: 'min(100dvh, 100vh)' }}>
      {/* atmosphere */}
      <div className="pointer-events-none fixed inset-0 z-[999]" style={{ backgroundImage: 'radial-gradient(ellipse at 75% -10%, oklch(0.78 0.18 55 / 0.10), transparent 50%), radial-gradient(ellipse at -10% 90%, oklch(0.50 0.10 30 / 0.06), transparent 55%)' }} />

      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-2 bg-gradient-to-b from-surface to-bg px-3 py-2.5 md:px-5 md:py-3 shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange to-orange-deep text-ink-deep shadow-glow ring-1 ring-white/10">🐻</span>
          <h1 className="font-display text-xl md:text-2xl leading-none">atticus <em className="not-italic text-orange italic font-display">face</em></h1>
          <span className="hidden md:inline-block border-l border-line pl-2.5 ml-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">v4 · grid</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleLiveToggle}
          className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all min-h-9', liveOn ? 'border-good/60 bg-good/15 text-ink' : 'border-line bg-surface-2 text-ink-dim hover:border-orange')}
        >
          <span className={cn('h-2 w-2 rounded-full', liveOn ? 'bg-good shadow-[0_0_0_4px_oklch(0.78_0.16_145/0.18)]' : 'bg-ink-faint')} style={liveOn ? { animation: 'livePulse 2s infinite' } : undefined} />
          <span>{liveOn && liveCfg ? `Live · ${new URL(liveCfg.url).host}` : 'Live Mirror'}</span>
        </button>
        <Button size="icon" variant="default" onClick={handleSave} aria-label="Save"><Save className="h-4 w-4" /></Button>
        <Button size="icon" variant="default" onClick={handleLoad} aria-label="Load"><FolderOpen className="h-4 w-4" /></Button>
        <Button size="icon" variant="default" onClick={() => setImportOpen(true)} aria-label="Import"><Upload className="h-4 w-4" /></Button>
        <Button size="sm" variant="default" onClick={() => setExportOpen('json')}><Braces className="h-4 w-4" /> JSON</Button>
        <Button size="sm" variant="primary" onClick={() => setExportOpen('c')}><Code2 className="h-4 w-4" /> C</Button>
      </header>

      <ExpressionSwitcher
        doc={doc}
        activeId={activeExprId}
        onSelect={switchExpr}
        onAdd={addExpression}
      />

      <div className="max-w-full block md:flex-1 md:min-h-0 md:grid md:grid-cols-[1fr_22rem] md:overflow-hidden">
        <main className="block bg-gradient-to-b from-bg via-bg to-bg-deep md:flex md:flex-col md:min-h-0 md:overflow-hidden">
          <GridStage
            doc={doc} expr={activeExpr} t={playT} selectionId={activeElemId}
            showGrid={showGrid} symmetry={symmetry}
            onSelect={setActiveElemId}
            onMoveElem={moveElem}
            onResizeElem={resizeElem}
            onPlace={placeElement}
            placingKind={placingKind}
          />

          {/* Canvas toolbar — part picker + grid/symmetry/delete */}
          <div className="px-3 md:px-5 pb-2 space-y-2 shrink-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-ink-faint mr-1">add:</span>
              {(['ellipse', 'rect', 'arc'] as Kind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setPlacingKind(placingKind === k ? null : k)}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-10 px-3 rounded-md border text-[11px] font-mono uppercase tracking-wider transition-all min-h-10',
                    placingKind === k ? 'bg-orange text-ink-deep border-orange shadow-glow' : 'bg-surface/40 border-line text-ink-dim hover:border-orange hover:text-ink',
                  )}
                >
                  <Plus className="h-3 w-3" /> {k}
                </button>
              ))}
              <div className="flex-1" />
              <button
                onClick={() => setSymmetry((s) => !s)}
                title="Symmetry — mirror edits left↔right"
                className={cn(
                  'inline-flex items-center gap-1.5 h-10 px-3 rounded-md border text-[11px] font-mono uppercase tracking-wider transition-all',
                  symmetry ? 'bg-orange/15 text-orange border-orange/60' : 'bg-surface/40 border-line text-ink-dim hover:border-orange hover:text-ink',
                )}
              >
                <FlipHorizontal2 className="h-3.5 w-3.5" /> sym
              </button>
              <button
                onClick={() => setShowGrid((g) => !g)}
                title="Toggle grid overlay"
                className={cn(
                  'inline-flex items-center gap-1.5 h-10 px-3 rounded-md border text-[11px] font-mono uppercase tracking-wider transition-all',
                  showGrid ? 'bg-orange/15 text-orange border-orange/60' : 'bg-surface/40 border-line text-ink-dim hover:border-orange hover:text-ink',
                )}
              >
                <Grid3x3 className="h-3.5 w-3.5" /> grid
              </button>
              <button
                onClick={() => { if (activeElemId) deleteElement(activeElemId) }}
                disabled={!activeElemId}
                title="Delete selected part"
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md border border-line text-ink-dim hover:border-bad hover:text-bad text-[11px] font-mono uppercase tracking-wider transition-all disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-dim"
              >
                <Trash2 className="h-3.5 w-3.5" /> del
              </button>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] font-mono text-ink-faint">
              <span><span className="uppercase tracking-wider mr-1.5 text-[9px]">expr</span><b className="text-orange font-medium">{activeExpr?.name ?? '—'}</b></span>
              <span><span className="uppercase tracking-wider mr-1.5 text-[9px]">selected</span><b className="text-ink font-medium">{activeElem?.name ?? 'tap a part'}</b></span>
              <span><span className="uppercase tracking-wider mr-1.5 text-[9px]">grid</span><b className="text-ink-dim font-medium">{GRID_COLS}×{GRID_ROWS}</b></span>
            </div>
          </div>

          {/* Playback */}
          <div className="flex items-center gap-2 px-4 py-2 shrink-0">
            <Button size="icon" variant="primary" onClick={() => setPlaying((p) => !p)} disabled={(activeExpr?.duration ?? 0) === 0} aria-label={playing ? 'pause' : 'play'}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="default" onClick={() => { setPlaying(false); setPlayT(0) }} aria-label="stop"><Square className="h-3.5 w-3.5" /></Button>
            <div className="flex-1 min-w-0"><Slider min={0} max={Math.max(activeExpr?.duration || 0, 100)} step={10} value={[playT]} onValueChange={(v) => setPlayT(v[0])} disabled={(activeExpr?.duration ?? 0) === 0} /></div>
            <span className="font-mono text-[11px] text-ink-dim w-14 text-right">{(playT / 1000).toFixed(2)}s</span>
          </div>
        </main>

        <aside className="block bg-bg-deep md:border-l md:border-line md:min-h-0 md:overflow-y-auto">
          {inspector}
        </aside>
      </div>

      <Dialog open={!!exportOpen} onOpenChange={(o) => !o && setExportOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{exportOpen === 'c' ? <>Generated <em className="text-orange italic">C</em></> : <>Face <em className="text-orange italic">JSON</em></>}</DialogTitle>
          </DialogHeader>
          <textarea readOnly value={exportText} className="h-[60vh] w-full rounded-md bg-bg-deep border border-line p-3 font-mono text-base md:text-xs leading-relaxed text-ink resize-none focus:border-orange focus:outline-none" />
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button variant="default">Close</Button></DialogClose>
            <Button variant="primary" onClick={async () => { await navigator.clipboard.writeText(exportText); toast('copied') }}><Copy className="h-4 w-4" /> Copy</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import <em className="text-orange italic">JSON</em></DialogTitle></DialogHeader>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste exported face JSON here…" className="h-[50vh] w-full rounded-md bg-bg-deep border border-line p-3 font-mono text-base md:text-xs leading-relaxed text-ink resize-none focus:border-orange focus:outline-none" />
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button variant="default">Cancel</Button></DialogClose>
            <Button variant="primary" onClick={handleImport}>Import</Button>
          </div>
        </DialogContent>
      </Dialog>

      {toastNode}

      <style>{`
        @keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes livePulse { 0%,100% { box-shadow: 0 0 0 4px oklch(0.78 0.16 145 / 0.18); } 50% { box-shadow: 0 0 0 8px oklch(0.78 0.16 145 / 0.05); } }
      `}</style>
    </div>
  )
}
