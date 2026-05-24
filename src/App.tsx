import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Play, Pause, Square, Save, FolderOpen, Upload, Code2, Braces, Copy, X, Plus, Trash2, Diamond, ChevronDown } from 'lucide-react'
import { Button, Slider, Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './lib/ui'
import { cn, uid } from './lib/util'
import {
  type FaceDoc, type Expression, type FaceElement, type Kind,
  LCD_W, LCD_H, DEFAULT_COLORS, seedDoc, drawDoc, hitTest, generateC,
} from './lib/face'

const STORAGE_KEY = 'atticus-face-studio-v3'

/* ============================================================
 * Numeric input: slider + tap-to-edit field
 * Tap the number → text field opens; commit on blur or Enter
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
          if (e.key === 'Enter') { e.currentTarget.blur() }
          else if (e.key === 'Escape') { setDraft(String(Math.round(value))); setEditing(false) }
        }}
        className={cn('h-9 w-full rounded-md bg-surface border border-orange px-2 text-right font-mono text-xs text-ink focus:outline-none', className)}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn('h-9 w-full rounded-md bg-surface/60 border border-line px-2 text-right font-mono text-xs text-ink-dim hover:border-orange hover:text-ink transition-colors', className)}
      title="Tap to type exact value"
    >
      {Math.round(value)}
    </button>
  )
}

/* ============================================================
 * Stage canvas
 * ============================================================ */
function Stage({
  doc, expr, t, selectionId, onSelect, onDragElem,
}: {
  doc: FaceDoc
  expr: Expression | undefined
  t: number
  selectionId: string | null
  onSelect: (id: string | null) => void
  onDragElem: (id: string, x: number, y: number) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const [size, setSize] = useState({ w: 320, h: 240 })

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(() => {
      if (!wrapRef.current) return
      const r = wrapRef.current.getBoundingClientRect()
      const ar = LCD_W / LCD_H
      let w = r.width, h = w / ar
      if (h > r.height) { h = r.height; w = h * ar }
      w = Math.max(80, Math.floor(w))
      h = Math.max(60, Math.floor(h))
      setSize({ w, h })
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
    drawDoc(ctx, canvas.width, canvas.height, doc, expr, t, selectionId, true)
  }, [size, doc, expr, t, selectionId])

  const eventToLcd = useCallback((ev: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: ((ev.clientX - rect.left) / rect.width) * LCD_W, y: ((ev.clientY - rect.top) / rect.height) * LCD_H }
  }, [])

  return (
    <div ref={wrapRef} className="flex-1 min-h-0 flex items-center justify-center p-3 md:p-5 max-w-full overflow-hidden">
      <div className="relative bg-black rounded-2xl shadow-stage max-w-full max-h-full" style={{ width: size.w, height: size.h }}>
        <canvas
          ref={canvasRef}
          className="block w-full h-full rounded-2xl"
          style={{ imageRendering: 'pixelated', touchAction: 'none' }}
          onPointerDown={(ev) => {
            (ev.target as Element).setPointerCapture(ev.pointerId)
            const p = eventToLcd(ev)
            const hit = expr ? hitTest(expr, p, t) : null
            if (hit) { onSelect(hit.id); dragRef.current = { id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y } }
            else { onSelect(null); dragRef.current = null }
          }}
          onPointerMove={(ev) => {
            const d = dragRef.current
            if (!d || !expr) return
            const p = eventToLcd(ev)
            onDragElem(d.id, Math.round(p.x - d.dx), Math.round(p.y - d.dy))
          }}
          onPointerUp={() => { dragRef.current = null }}
          onPointerCancel={() => { dragRef.current = null }}
        />
      </div>
    </div>
  )
}

/* ============================================================
 * Expression thumbnail
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
 * Expression switcher — horizontal strip, sits above the stage
 * Top-level navigation. Visible on every screen size.
 * ============================================================ */
function ExpressionSwitcher({
  doc, activeId, onSelect, onAdd,
}: { doc: FaceDoc; activeId: string; onSelect: (id: string) => void; onAdd: () => void }) {
  return (
    <div className="shrink-0 border-b border-line bg-bg-deep/60">
      <div className="flex gap-2 overflow-x-auto px-3 py-2.5 md:px-5 snap-x snap-mandatory">
        {doc.expressions.map((ex) => {
          const isActive = ex.id === activeId
          const hasAnim = ex.duration > 0 && ex.elements.some((el) => Object.keys(el.keyframes || {}).length > 0)
          return (
            <button
              key={ex.id}
              onClick={() => onSelect(ex.id)}
              className={cn(
                'group relative shrink-0 snap-start rounded-lg border p-1.5 transition-all',
                isActive ? 'border-orange bg-gradient-to-br from-[oklch(0.22_0.05_55)] to-surface shadow-glow' : 'border-line bg-surface hover:border-ink-faint hover:bg-surface-2',
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
 * Unified Parts + Properties inspector
 * Selected part expands inline (accordion). No tab-switching.
 * ============================================================ */
function PartsInspector({
  expr, activeElemId, playT,
  onSelect, onDelete, onAdd,
  onChange, onColor, onRename, onToggleKf,
  onClearTrack, onSetKfValue, onSetKfTime, onRemoveKf,
}: {
  expr: Expression | undefined
  activeElemId: string | null
  playT: number
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
  onAdd: (kind: Kind) => void
  onChange: (prop: string, v: number) => void
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
      {/* Add-row first, low-friction */}
      <div className="grid grid-cols-3 gap-2">
        {(['ellipse', 'rect', 'arc'] as Kind[]).map((k) => (
          <Button key={k} variant="outline" size="sm" onClick={() => onAdd(k)} className="font-medium uppercase tracking-wider text-[11px]">
            <Plus className="h-3 w-3" /> {k}
          </Button>
        ))}
      </div>

      {expr.elements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line py-8 text-center text-ink-faint">
          <div className="font-display text-xl italic text-ink-dim">Empty face</div>
          <div className="text-sm mt-1">Add a part above to start.</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {expr.elements.map((el) => {
            const hasKf = Object.keys(el.keyframes || {}).length > 0
            const isActive = el.id === activeElemId
            return (
              <PartRow
                key={el.id}
                el={el}
                isActive={isActive}
                hasKf={hasKf}
                playT={playT}
                onSelect={() => onSelect(isActive ? null : el.id)}
                onDelete={() => onDelete(el.id)}
                onChange={onChange}
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
  el, isActive, hasKf, playT,
  onSelect, onDelete, onChange, onColor, onRename, onToggleKf,
  onClearTrack, onSetKfValue, onSetKfTime, onRemoveKf,
}: {
  el: FaceElement; isActive: boolean; hasKf: boolean; playT: number
  onSelect: () => void; onDelete: () => void
  onChange: (p: string, v: number) => void; onColor: (c: string) => void; onRename: (n: string) => void
  onToggleKf: (p: string) => void; onClearTrack: (p: string) => void
  onSetKfValue: (p: string, i: number, v: any) => void
  onSetKfTime: (p: string, i: number, t: number) => void
  onRemoveKf: (p: string, i: number) => void
}) {
  const propsByKind: Record<Kind, Array<[string, number, number]>> = {
    ellipse: [['x', 0, LCD_W], ['y', 0, LCD_H], ['w', 2, LCD_W * 2], ['h', 2, LCD_H * 2]],
    rect: [['x', 0, LCD_W], ['y', 0, LCD_H], ['w', 2, LCD_W], ['h', 2, LCD_H]],
    arc: [['x', 0, LCD_W], ['y', 0, LCD_H], ['r', 2, 200], ['thick', 1, 40], ['start', -360, 360], ['end', -360, 360]],
  }
  const hasColorKf = !!el.keyframes?.color?.length
  const tracks = Object.keys(el.keyframes || {}).filter((k) => el.keyframes[k].length > 0)

  return (
    <div className={cn('rounded-lg border transition-all overflow-hidden', isActive ? 'border-orange bg-bg/30 shadow-glow' : 'border-line bg-surface/40 hover:border-ink-faint')}>
      {/* Header — click to expand/collapse */}
      <button
        onClick={onSelect}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <span className="h-4 w-4 shrink-0 rounded ring-1 ring-black/40" style={{ background: el.color }} />
        <span className="flex-1 truncate text-[13px] font-medium">{el.name || el.kind}</span>
        {hasKf && <Diamond className="h-3 w-3 text-good shrink-0" fill="currentColor" />}
        <span className="font-mono text-[10px] text-ink-faint uppercase tracking-wider">{el.kind}</span>
        <ChevronDown className={cn('h-4 w-4 text-ink-faint transition-transform shrink-0', isActive && 'rotate-180')} />
      </button>

      {/* Body — visible only when selected */}
      {isActive && (
        <div className="border-t border-line/60 bg-bg-deep/40 px-3 py-3 space-y-3">
          {/* Name + delete + color */}
          <div className="grid grid-cols-[1fr_2.5rem_2.5rem] gap-2 items-center">
            <input
              type="text"
              value={el.name}
              onChange={(e) => onRename(e.target.value)}
              placeholder="Name"
              className="h-9 rounded-md bg-surface border border-line px-3 text-sm text-ink focus:border-orange focus:outline-none"
            />
            <div className="relative h-9">
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
              className="h-9 rounded-md border border-line text-ink-faint hover:border-bad hover:text-bad transition-colors"
              aria-label="delete part"
            >
              <Trash2 className="h-4 w-4 mx-auto" />
            </button>
          </div>

          {/* Property sliders */}
          <div className="space-y-2">
            {propsByKind[el.kind].map(([p, lo, hi]) => {
              const v = (el as any)[p] ?? 0
              const hasPropKf = !!el.keyframes?.[p]?.length
              return (
                <div key={p} className="grid grid-cols-[2.25rem_1fr_3.5rem_2.25rem] items-center gap-2">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">{p}</label>
                  <Slider min={lo} max={hi} step={1} value={[v]} onValueChange={(val) => onChange(p, val[0])} />
                  <NumberField value={v} min={lo} max={hi} onChange={(n) => onChange(p, n)} />
                  <button
                    onClick={() => onToggleKf(p)}
                    title={hasPropKf ? 'has keyframes — set at playhead' : 'set keyframe at playhead'}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-md border transition-all',
                      hasPropKf ? 'bg-good/20 border-good/60 text-good' : 'border-line text-ink-faint hover:border-orange hover:text-orange',
                    )}
                  >
                    <Diamond className="h-3.5 w-3.5" fill={hasPropKf ? 'currentColor' : 'none'} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Color keyframe toggle */}
          <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-2">
            <label className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">color</label>
            <span className="text-[11px] text-ink-dim">Animate color over time</span>
            <button
              onClick={() => onToggleKf('color')}
              className={cn('flex h-9 w-9 items-center justify-center rounded-md border transition-all', hasColorKf ? 'bg-good/20 border-good/60 text-good' : 'border-line text-ink-faint hover:border-orange hover:text-orange')}
            >
              <Diamond className="h-3.5 w-3.5" fill={hasColorKf ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Keyframe tracks */}
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
                          <NumberField value={kf.t} min={0} max={60000} step={10} onChange={(t) => onSetKfTime(k, i, t)} className="text-orange" />
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
 * Expression meta panel (sits at top of inspector)
 * ============================================================ */
function ExpressionMeta({
  expr, doc, onMutate, onSelect, onDelete,
}: { expr: Expression | undefined; doc: FaceDoc; onMutate: (key: 'id' | 'name' | 'duration', v: any) => void; onSelect: (id: string) => void; onDelete: () => void }) {
  if (!expr) return null
  return (
    <div className="border-b border-line/60 p-3 md:p-4 space-y-2.5">
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
          className="h-9 rounded-md bg-surface border border-line px-3 text-sm text-ink focus:border-orange focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-[3.5rem_1fr] gap-2 items-center">
        <label className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">ID</label>
        <input
          type="text"
          value={expr.id}
          onChange={(e) => onMutate('id', e.target.value)}
          className="h-9 rounded-md bg-surface border border-line px-3 text-sm text-ink font-mono focus:border-orange focus:outline-none"
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
            // tell parent to add
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
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 space-y-2">
      {list.map((t) => (
        <div key={t.id} className="rounded-full bg-orange px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[oklch(0.16_0.05_50)] shadow-[0_8px_24px_rgba(0,0,0,0.4)]" style={{ animation: 'toastIn .25s ease-out' }}>
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
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const p = JSON.parse(raw); if (p?.expressions?.length) return p } } catch {}
    return seedDoc()
  })
  const [activeExprId, setActiveExprId] = useState(doc.expressions[0].id)
  const [activeElemId, setActiveElemId] = useState<string | null>(null)
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
  const mutateAnyElem = (id: string, fn: (el: FaceElement) => void) => mutate((d) => { const ex = d.expressions.find((e) => e.id === activeExprId); const el = ex?.elements.find((e) => e.id === id); if (el) fn(el) })

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

  /* keyboard nudges */
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tgt = ev.target as HTMLElement
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return
      if (!activeElem) return
      const step = ev.shiftKey ? 10 : 1
      let handled = true
      if (ev.key === 'ArrowLeft') mutateElem((el) => { el.x -= step })
      else if (ev.key === 'ArrowRight') mutateElem((el) => { el.x += step })
      else if (ev.key === 'ArrowUp') mutateElem((el) => { el.y -= step })
      else if (ev.key === 'ArrowDown') mutateElem((el) => { el.y += step })
      else if (ev.key === 'Delete' || ev.key === 'Backspace') {
        mutate((d) => { const ex = d.expressions.find((e) => e.id === activeExprId); if (ex) ex.elements = ex.elements.filter((e) => e.id !== activeElemId) })
        setActiveElemId(null)
      } else handled = false
      if (handled) ev.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeElem, activeElemId, activeExprId])

  /* listen for duplicate-expr event (from inline button) */
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
  const addElement = (kind: Kind) => {
    const id = uid()
    const base: FaceElement = { id, role: kind, name: kind[0].toUpperCase() + kind.slice(1), kind, color: DEFAULT_COLORS.EYE, keyframes: {}, x: 0, y: 0 }
    if (kind === 'ellipse') Object.assign(base, { x: 160, y: 120, w: 40, h: 40 })
    else if (kind === 'rect') Object.assign(base, { x: 140, y: 110, w: 40, h: 20 })
    else if (kind === 'arc') Object.assign(base, { x: 160, y: 170, r: 30, thick: 5, start: 0, end: 180 })
    mutate((d) => { const ex = d.expressions.find((e) => e.id === activeExprId); if (ex) ex.elements.push(base) })
    setActiveElemId(id)
  }
  const deleteElement = (id: string) => {
    mutate((d) => { const ex = d.expressions.find((e) => e.id === activeExprId); if (ex) ex.elements = ex.elements.filter((e) => e.id !== id) })
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

  /* ---------- Render ---------- */
  const inspector = (
    <>
      <ExpressionMeta
        expr={activeExpr}
        doc={doc}
        onMutate={(k, v) => {
          mutate((d) => { const ex = d.expressions.find((x) => x.id === activeExprId); if (ex) (ex as any)[k] = v })
          if (k === 'id' && typeof v === 'string') setActiveExprId(v)
        }}
        onSelect={setActiveExprId}
        onDelete={handleDeleteExpr}
      />
      <PartsInspector
        expr={activeExpr}
        activeElemId={activeElemId}
        playT={playT}
        onSelect={setActiveElemId}
        onDelete={deleteElement}
        onAdd={addElement}
        onChange={(p, v) => mutateElem((el) => { (el as any)[p] = v })}
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

  return (
    <div className="flex h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden bg-bg">
      {/* atmosphere */}
      <div className="pointer-events-none fixed inset-0 z-[999]" style={{ backgroundImage: 'radial-gradient(ellipse at 75% -10%, oklch(0.78 0.18 55 / 0.10), transparent 50%), radial-gradient(ellipse at -10% 90%, oklch(0.50 0.10 30 / 0.06), transparent 55%)' }} />

      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-gradient-to-b from-surface to-bg px-3 py-2.5 md:px-5 md:py-3 shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange to-orange-deep text-[oklch(0.18_0.05_50)] shadow-glow ring-1 ring-white/10">🐻</span>
          <h1 className="font-display text-xl md:text-2xl leading-none">atticus <em className="not-italic text-orange italic font-display">face</em></h1>
          <span className="hidden md:inline-block border-l border-line pl-2.5 ml-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">studio</span>
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

      {/* Expression switcher — top-level navigation, every breakpoint */}
      <ExpressionSwitcher
        doc={doc}
        activeId={activeExprId}
        onSelect={(id) => { setActiveExprId(id); setActiveElemId(null); setPlayT(0); setPlaying(false) }}
        onAdd={addExpression}
      />

      {/* Body: desktop = stage + sidebar | mobile = stack */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[1fr_auto] md:grid-cols-[1fr_22rem] md:grid-rows-1 max-w-full overflow-hidden">
        <main className="flex min-h-0 flex-col overflow-hidden bg-gradient-to-b from-bg via-bg to-bg-deep">
          <Stage
            doc={doc} expr={activeExpr} t={playT} selectionId={activeElemId}
            onSelect={setActiveElemId}
            onDragElem={(id, x, y) => mutateAnyElem(id, (el) => { el.x = x; el.y = y })}
          />
          <div className="border-y border-line bg-bg-deep px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] font-mono text-ink-faint shrink-0">
            <span><span className="uppercase tracking-wider mr-1.5 text-[9px]">expr</span><b className="text-orange font-medium">{activeExpr?.name ?? '—'}</b></span>
            <span><span className="uppercase tracking-wider mr-1.5 text-[9px]">selected</span><b className="text-ink font-medium">{activeElem?.name ?? 'tap a part'}</b></span>
          </div>
          <div className="flex items-center gap-2 bg-bg-deep px-4 py-2 shrink-0">
            <Button size="icon" variant="primary" onClick={() => setPlaying((p) => !p)} disabled={(activeExpr?.duration ?? 0) === 0} aria-label={playing ? 'pause' : 'play'}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="default" onClick={() => { setPlaying(false); setPlayT(0) }} aria-label="stop"><Square className="h-3.5 w-3.5" /></Button>
            <div className="flex-1 min-w-0"><Slider min={0} max={Math.max(activeExpr?.duration || 0, 100)} step={10} value={[playT]} onValueChange={(v) => setPlayT(v[0])} disabled={(activeExpr?.duration ?? 0) === 0} /></div>
            <span className="font-mono text-[11px] text-ink-dim w-14 text-right">{(playT / 1000).toFixed(2)}s</span>
          </div>
        </main>

        {/* Inspector — desktop sidebar */}
        <aside className="hidden md:block border-l border-line bg-bg-deep overflow-y-auto">
          {inspector}
        </aside>

        {/* Inspector — mobile bottom panel (no tabs; one scrollable area) */}
        <section className="md:hidden flex flex-col border-t border-line bg-bg-deep min-h-0 shadow-[0_-8px_24px_rgba(0,0,0,0.4)]" style={{ height: '48dvh', maxHeight: '60dvh' }}>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {inspector}
          </div>
        </section>
      </div>

      {/* Export modal */}
      <Dialog open={!!exportOpen} onOpenChange={(o) => !o && setExportOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{exportOpen === 'c' ? <>Generated <em className="text-orange italic">C</em></> : <>Face <em className="text-orange italic">JSON</em></>}</DialogTitle>
          </DialogHeader>
          <textarea readOnly value={exportText} className="h-[60vh] w-full rounded-md bg-bg-deep border border-line p-3 font-mono text-xs leading-relaxed text-ink resize-none focus:border-orange focus:outline-none" />
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button variant="default">Close</Button></DialogClose>
            <Button variant="primary" onClick={async () => { await navigator.clipboard.writeText(exportText); toast('copied') }}><Copy className="h-4 w-4" /> Copy</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import modal */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import <em className="text-orange italic">JSON</em></DialogTitle></DialogHeader>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste exported face JSON here…" className="h-[50vh] w-full rounded-md bg-bg-deep border border-line p-3 font-mono text-xs leading-relaxed text-ink resize-none focus:border-orange focus:outline-none" />
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
