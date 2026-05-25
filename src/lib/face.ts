import { uid } from './util'

export const LCD_W = 320
export const LCD_H = 240
export const DEFAULT_COLORS = { BEAR: '#ff8a2b', EYE: '#f3ead9', MOUTH: '#f3ead9', BG: '#000000' }

export type Kind = 'ellipse' | 'rect' | 'arc'
export type Track<T = number | string> = { t: number; v: T; easing?: 'linear' | 'easeInOut' }[]

export interface FaceElement {
  id: string
  role: string
  name: string
  kind: Kind
  color: string
  x: number
  y: number
  w?: number
  h?: number
  r?: number
  thick?: number
  start?: number
  end?: number
  keyframes: Record<string, Track>
}

export interface Expression {
  id: string
  name: string
  duration: number
  elements: FaceElement[]
}

export interface FaceDoc {
  version: number
  width: number
  height: number
  background: string
  expressions: Expression[]
}

export function seedDoc(): FaceDoc {
  // Layout constants — phone-friendly defaults; everything snaps to the 5px grid.
  const EYE_L = 100, EYE_R = 220, EYE_Y = 105
  const MOUTH_X = 160, MOUTH_Y = 170
  const CREAM = DEFAULT_COLORS.EYE
  const PINK = '#ff8a7a'
  const RED = '#ff5a5a'
  const GRAY = '#7a7065'
  const ACCENT = '#9bd5a0'

  type Side = 'left' | 'right'
  const ex = (side: Side) => side === 'left' ? EYE_L : EYE_R
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
  const roleEye = (s: Side) => s + 'Eye'
  const roleBrow = (s: Side) => s + 'Brow'
  const nameEye = (s: Side) => cap(s) + ' Eye'
  const nameBrow = (s: Side) => cap(s) + ' Brow'

  // Building blocks ----------------------------------------------------------
  const dotEye = (side: Side, cy = EYE_Y, r = 12, color = CREAM): FaceElement => ({
    id: uid(), role: roleEye(side), name: nameEye(side),
    kind: 'ellipse', x: ex(side), y: cy, w: r * 2, h: r * 2, color, keyframes: {},
  })
  const barEye = (side: Side, cy = EYE_Y, w = 32, h = 6, color = CREAM): FaceElement => ({
    id: uid(), role: roleEye(side), name: nameEye(side),
    kind: 'rect', x: ex(side) - w / 2, y: cy - h / 2, w, h, color, keyframes: {},
  })
  // up=true → ^ shape (happy eye, opens downward); up=false → u shape (sleepy/sad)
  const archEye = (side: Side, cy = EYE_Y, r = 22, thick = 4, up = true, color = CREAM): FaceElement => ({
    id: uid(), role: roleEye(side), name: nameEye(side),
    kind: 'arc', x: ex(side), y: cy, r, thick,
    start: up ? 180 : 0, end: up ? 360 : 180, color, keyframes: {},
  })
  const ringEye = (side: Side, cy = EYE_Y, r = 18, thick = 3, color = CREAM): FaceElement => ({
    id: uid(), role: roleEye(side), name: nameEye(side),
    kind: 'arc', x: ex(side), y: cy, r, thick, start: 0, end: 360, color, keyframes: {},
  })
  const pupil = (side: Side, dx = 0, dy = 0, r = 5, color = CREAM): FaceElement => ({
    id: uid(), role: roleEye(side) + 'Pupil', name: nameEye(side) + ' Pupil',
    kind: 'ellipse', x: ex(side) + dx, y: EYE_Y + dy, w: r * 2, h: r * 2, color, keyframes: {},
  })
  const browArch = (side: Side, cy = EYE_Y - 28, r = 16, thick = 3, color = CREAM): FaceElement => ({
    id: uid(), role: roleBrow(side), name: nameBrow(side),
    kind: 'arc', x: ex(side), y: cy, r, thick, start: 0, end: 180, color, keyframes: {},
  })
  const mouthArc = (r = 22, thick = 4, up = false, color = CREAM, y = MOUTH_Y): FaceElement => ({
    id: uid(), role: 'mouth', name: 'Mouth', kind: 'arc',
    x: MOUTH_X, y, r, thick, start: up ? 180 : 0, end: up ? 360 : 180, color, keyframes: {},
  })
  const mouthDot = (r = 7, color = CREAM, y = MOUTH_Y + 4): FaceElement => ({
    id: uid(), role: 'mouth', name: 'Mouth', kind: 'ellipse',
    x: MOUTH_X, y, w: r * 2, h: r * 2, color, keyframes: {},
  })
  const mouthRing = (r = 12, thick = 3, color = CREAM, y = MOUTH_Y + 6): FaceElement => ({
    id: uid(), role: 'mouth', name: 'Mouth', kind: 'arc',
    x: MOUTH_X, y, r, thick, start: 0, end: 360, color, keyframes: {},
  })
  const mouthBar = (w = 40, h = 5, y = MOUTH_Y, color = CREAM): FaceElement => ({
    id: uid(), role: 'mouth', name: 'Mouth', kind: 'rect',
    x: MOUTH_X - w / 2, y: y - h / 2, w, h, color, keyframes: {},
  })
  const cheekDots = (side: Side): FaceElement[] => {
    const base = side === 'left' ? 45 : 275
    const dir = side === 'left' ? -1 : 1
    return [0, 1, 2].map((i) => ({
      id: uid(), role: side + 'Cheek' + i, name: cap(side) + ' Cheek ' + (i + 1),
      kind: 'ellipse', x: base + dir * i * 9, y: 150,
      w: 5, h: 5, color: PINK, keyframes: {},
    }))
  }
  // Heart approximation: 2 small ellipses + 1 small rotated-ish square via rect (no rotation, so a small diamond-ish stack).
  const heart = (side: Side, color = RED): FaceElement[] => {
    const cx = ex(side), cy = EYE_Y
    return [
      { id: uid(), role: roleEye(side), name: nameEye(side) + ' Heart L', kind: 'ellipse',
        x: cx - 6, y: cy - 4, w: 14, h: 14, color, keyframes: {} },
      { id: uid(), role: roleEye(side) + 'B', name: nameEye(side) + ' Heart R', kind: 'ellipse',
        x: cx + 6, y: cy - 4, w: 14, h: 14, color, keyframes: {} },
      { id: uid(), role: roleEye(side) + 'C', name: nameEye(side) + ' Heart Point', kind: 'rect',
        x: cx - 8, y: cy + 2, w: 16, h: 12, color, keyframes: {} },
    ]
  }
  // X eye approximation (no rotation): two crossed thin rects → a plus. Visually reads as "dead-eye".
  const xEye = (side: Side, color = CREAM): FaceElement[] => {
    const cx = ex(side), cy = EYE_Y
    return [
      { id: uid(), role: roleEye(side), name: nameEye(side) + ' X H', kind: 'rect',
        x: cx - 12, y: cy - 2, w: 24, h: 4, color, keyframes: {} },
      { id: uid(), role: roleEye(side) + 'V', name: nameEye(side) + ' X V', kind: 'rect',
        x: cx - 2, y: cy - 12, w: 4, h: 24, color, keyframes: {} },
    ]
  }
  const zzz = (): FaceElement[] => [
    { id: uid(), role: 'decor1', name: 'z 1', kind: 'rect', x: 175, y: 70, w: 8, h: 3, color: ACCENT, keyframes: {} },
    { id: uid(), role: 'decor2', name: 'z 2', kind: 'rect', x: 185, y: 60, w: 10, h: 3, color: ACCENT, keyframes: {} },
    { id: uid(), role: 'decor3', name: 'z 3', kind: 'rect', x: 195, y: 50, w: 12, h: 3, color: ACCENT, keyframes: {} },
  ]

  // Breathing keyframes — dot eyes gently expand/contract over 3s.
  const breatheTrack = (base: number): Track => [
    { t: 0, v: base, easing: 'easeInOut' },
    { t: 1500, v: base + 6, easing: 'easeInOut' },
    { t: 3000, v: base, easing: 'easeInOut' },
  ]
  // Blink: open→closed→open over a small window every 4s.
  const blinkTrack: Track = [
    { t: 0, v: 24 }, { t: 1800, v: 24 },
    { t: 1900, v: 4 }, { t: 2000, v: 24 }, { t: 4000, v: 24 },
  ]

  // Expressions -------------------------------------------------------------
  const breathingL = dotEye('left'); breathingL.keyframes = { w: breatheTrack(24), h: breatheTrack(24) }
  const breathingR = dotEye('right'); breathingR.keyframes = { w: breatheTrack(24), h: breatheTrack(24) }
  const blinkingL: FaceElement = { id: uid(), role: 'leftEye', name: 'Left Eye', kind: 'ellipse',
    x: EYE_L, y: EYE_Y, w: 24, h: 24, color: CREAM, keyframes: { h: blinkTrack } }
  const blinkingR: FaceElement = { id: uid(), role: 'rightEye', name: 'Right Eye', kind: 'ellipse',
    x: EYE_R, y: EYE_Y, w: 24, h: 24, color: CREAM, keyframes: { h: blinkTrack } }

  return {
    version: 4, width: LCD_W, height: LCD_H, background: DEFAULT_COLORS.BG,
    expressions: [
      // 1. neutral: two filled dots, no mouth
      { id: 'neutral', name: 'Neutral', duration: 0, elements: [dotEye('left'), dotEye('right')] },
      // 2. blink: horizontal bars (single closed frame; for animation use breathing/blinking via tracks if desired)
      { id: 'blink', name: 'Blink', duration: 0, elements: [barEye('left'), barEye('right')] },
      // 3. breathing: dots that gently pulse
      { id: 'breathing', name: 'Breathing', duration: 3000, elements: [breathingL, breathingR] },
      // 4. happy: ^ ^ + smile
      { id: 'happy', name: 'Happy', duration: 0, elements: [archEye('left', EYE_Y, 20, 4, true), archEye('right', EYE_Y, 20, 4, true), mouthArc(20, 4, false)] },
      // 5. joy: ^ ^ + bigger smile + cheek dots
      { id: 'joy', name: 'Joy', duration: 0, elements: [
        archEye('left', EYE_Y, 22, 4, true), archEye('right', EYE_Y, 22, 4, true),
        mouthArc(26, 5, false),
        ...cheekDots('left'), ...cheekDots('right'),
      ] },
      // 6. love: two red hearts where eyes are + small smile
      { id: 'love', name: 'Love', duration: 0, elements: [...heart('left'), ...heart('right'), mouthArc(18, 4, false)] },
      // 7. wink: dot eye L, arch eye R, small smile
      { id: 'wink', name: 'Wink', duration: 0, elements: [dotEye('left', EYE_Y, 12), archEye('right', EYE_Y, 20, 4, true), mouthArc(16, 4, false)] },
      // 8. listening: ring eyes with pupils, neutral bar mouth
      { id: 'listening', name: 'Listening', duration: 0, elements: [
        ringEye('left', EYE_Y, 20, 3), pupil('left', 0, 0, 5),
        ringEye('right', EYE_Y, 20, 3), pupil('right', 0, 0, 5),
        mouthBar(40, 5),
      ] },
      // 9. speaking: dot eyes + small O mouth (ellipse)
      { id: 'speaking', name: 'Speaking', duration: 0, elements: [dotEye('left'), dotEye('right'), mouthDot(8)] },
      // 10. thinking: ring eyes with pupils glancing up-right + small dots beside head
      { id: 'thinking', name: 'Thinking', duration: 0, elements: [
        ringEye('left', EYE_Y, 20, 3), pupil('left', 6, -4, 4),
        ringEye('right', EYE_Y, 20, 3), pupil('right', 6, -4, 4),
        { id: uid(), role: 'decor1', name: 'Dot 1', kind: 'ellipse', x: 275, y: 70, w: 6, h: 6, color: ACCENT, keyframes: {} },
        { id: uid(), role: 'decor2', name: 'Dot 2', kind: 'ellipse', x: 285, y: 60, w: 8, h: 8, color: ACCENT, keyframes: {} },
      ] },
      // 11. surprised: bigger rings + brows above + small o mouth
      { id: 'surprised', name: 'Surprised', duration: 0, elements: [
        browArch('left', EYE_Y - 28, 18, 3), browArch('right', EYE_Y - 28, 18, 3),
        ringEye('left', EYE_Y, 22, 3), ringEye('right', EYE_Y, 22, 3),
        mouthRing(10, 3),
      ] },
      // 12. confused: dot eye L with brow, X eye R, no mouth (could add ? glyph)
      { id: 'confused', name: 'Confused', duration: 0, elements: [
        browArch('left', EYE_Y - 22, 14, 3),
        dotEye('left', EYE_Y, 10),
        ...xEye('right'),
        { id: uid(), role: 'decor1', name: 'Question', kind: 'arc', x: 270, y: 60, r: 8, thick: 3, start: 200, end: 380, color: ACCENT, keyframes: {} },
        { id: uid(), role: 'decor2', name: 'Question dot', kind: 'ellipse', x: 270, y: 78, w: 4, h: 4, color: ACCENT, keyframes: {} },
      ] },
      // 13. sad: u u + small frown + tear under left eye
      { id: 'sad', name: 'Sad', duration: 0, elements: [
        archEye('left', EYE_Y, 18, 3, false), archEye('right', EYE_Y, 18, 3, false),
        mouthArc(18, 4, true),
        { id: uid(), role: 'tear', name: 'Tear', kind: 'ellipse', x: EYE_L - 10, y: EYE_Y + 30, w: 8, h: 12, color: RED, keyframes: {} },
      ] },
      // 14. sleepy: u u (closed) + zZz
      { id: 'sleepy', name: 'Sleepy', duration: 0, elements: [
        archEye('left', EYE_Y, 18, 3, false), archEye('right', EYE_Y, 18, 3, false),
        ...zzz(),
      ] },
      // 15. sleep: u u (closed), gray, no zZz
      { id: 'sleep', name: 'Sleep', duration: 0, elements: [
        archEye('left', EYE_Y, 18, 3, false, GRAY), archEye('right', EYE_Y, 18, 3, false, GRAY),
      ] },
      // 16. error: X eyes + flat bar mouth
      { id: 'error', name: 'Error', duration: 0, elements: [
        ...xEye('left'), ...xEye('right'),
        mouthBar(32, 4, MOUTH_Y),
      ] },
      // Bonus: blinking with full anim (kept from v3 — useful demo of keyframes)
      { id: 'blinking', name: 'Blinking (anim)', duration: 4000, elements: [blinkingL, blinkingR] },
    ],
  }
}

function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 }

export function sampleProp(elem: FaceElement, prop: string, t: number): any {
  const track = elem.keyframes?.[prop]
  if (!track || track.length === 0) return (elem as any)[prop]
  if (track.length === 1) return track[0].v
  let i = 0
  while (i < track.length - 1 && track[i + 1].t <= t) i++
  if (i >= track.length - 1) return track[track.length - 1].v
  const a = track[i], b = track[i + 1]
  if (b.t === a.t) return b.v
  const u = (t - a.t) / (b.t - a.t)
  if (typeof a.v === 'string') return u < 0.5 ? a.v : b.v
  const va = a.v as number, vb = b.v as number
  return va + (vb - va) * (a.easing === 'easeInOut' ? easeInOut(u) : u)
}

export function elemAt(elem: FaceElement, t: number): FaceElement {
  const out: any = { ...elem }
  for (const p of Object.keys(elem.keyframes || {})) out[p] = sampleProp(elem, p, t)
  return out
}

export function drawDoc(
  ctx: CanvasRenderingContext2D, w: number, h: number, doc: FaceDoc, expr: Expression | undefined,
  t: number, selectionId: string | null, showSelection: boolean,
) {
  const sx = w / LCD_W, sy = h / LCD_H
  ctx.fillStyle = doc.background
  ctx.fillRect(0, 0, w, h)
  if (!expr) return
  for (const el of expr.elements) {
    const e = elemAt(el, t)
    ctx.fillStyle = e.color
    if (e.kind === 'ellipse') {
      ctx.beginPath()
      ctx.ellipse(e.x * sx, e.y * sy, Math.max(1, (e.w ?? 0) / 2) * sx, Math.max(1, (e.h ?? 0) / 2) * sy, 0, 0, Math.PI * 2)
      ctx.fill()
    } else if (e.kind === 'rect') {
      ctx.fillRect(e.x * sx, e.y * sy, (e.w ?? 0) * sx, (e.h ?? 0) * sy)
    } else if (e.kind === 'arc') {
      const r = Math.max(1, e.r ?? 0), thick = Math.max(1, Math.min(e.thick ?? 0, r))
      ctx.beginPath()
      ctx.arc(e.x * sx, e.y * sy, r * sx, ((e.start ?? 0) * Math.PI) / 180, ((e.end ?? 0) * Math.PI) / 180)
      ctx.arc(e.x * sx, e.y * sy, (r - thick) * sx, ((e.end ?? 0) * Math.PI) / 180, ((e.start ?? 0) * Math.PI) / 180, true)
      ctx.closePath()
      ctx.fill()
    }
  }
  if (selectionId && showSelection) {
    const el = expr.elements.find((x) => x.id === selectionId)
    if (el) {
      const e = elemAt(el, t)
      ctx.strokeStyle = '#ff8a2b'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      if (e.kind === 'ellipse') {
        ctx.beginPath()
        ctx.ellipse(e.x * sx, e.y * sy, ((e.w ?? 0) / 2 + 4) * sx, ((e.h ?? 0) / 2 + 4) * sy, 0, 0, Math.PI * 2)
        ctx.stroke()
      } else if (e.kind === 'rect') {
        ctx.strokeRect(e.x * sx - 3, e.y * sy - 3, (e.w ?? 0) * sx + 6, (e.h ?? 0) * sy + 6)
      } else if (e.kind === 'arc') {
        ctx.beginPath()
        ctx.arc(e.x * sx, e.y * sy, ((e.r ?? 0) + 4) * sx, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.setLineDash([])
    }
  }
}

export function hitTest(expr: Expression, p: { x: number; y: number }, t: number): FaceElement | null {
  for (let i = expr.elements.length - 1; i >= 0; i--) {
    const el = expr.elements[i]
    const e = elemAt(el, t)
    let hit = false
    if (e.kind === 'ellipse') {
      const dx = (p.x - e.x) / Math.max(1, (e.w ?? 0) / 2)
      const dy = (p.y - e.y) / Math.max(1, (e.h ?? 0) / 2)
      hit = dx * dx + dy * dy <= 1
    } else if (e.kind === 'rect') {
      hit = p.x >= e.x && p.x <= e.x + (e.w ?? 0) && p.y >= e.y && p.y <= e.y + (e.h ?? 0)
    } else if (e.kind === 'arc') {
      const d = Math.hypot(p.x - e.x, p.y - e.y)
      hit = d <= (e.r ?? 0) + 8
    }
    if (hit) return el
  }
  return null
}

export function generateC(doc: FaceDoc): string {
  let s = '/* Auto-generated by atticus-face-studio. Drop into face_anim.c. */\n\n'
  s += 'typedef enum {\n'
  doc.expressions.forEach((ex, i) => { s += `    FACE_${ex.id.toUpperCase().replace(/[^A-Z0-9]/g, '_')} = ${i},\n` })
  s += '} face_expression_t;\n\n'
  s += 'static void face_render_expression(face_expression_t expr, uint32_t t_ms) {\n'
  s += '    memset(s_fb, 0, FB_BYTES);\n'
  s += '    switch (expr) {\n'
  for (const ex of doc.expressions) {
    s += `    case FACE_${ex.id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}: {\n`
    s += ex.duration > 0 ? `        uint32_t t = t_ms % ${ex.duration}u;\n` : `        (void)t_ms;\n`
    for (const el of ex.elements) {
      const ec = el.color.replace('#', '')
      const r = parseInt(ec.slice(0, 2), 16) || 0
      const g = parseInt(ec.slice(2, 4), 16) || 0
      const b = parseInt(ec.slice(4, 6), 16) || 0
      const rgb565 = ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3)
      const hex = '0x' + rgb565.toString(16).padStart(4, '0').toUpperCase()
      const sample = (p: string) => {
        const track = el.keyframes?.[p]
        if (track && track.length) {
          let lines = ''
          lines += `        int ${p}_val;\n        {\n`
          lines += `            uint32_t kt[] = {${track.map((k) => k.t).join(', ')}};\n`
          lines += `            int kv[] = {${track.map((k) => Math.round(k.v as number)).join(', ')}};\n`
          lines += `            int n = ${track.length}; int i = 0;\n`
          lines += `            while (i < n-1 && kt[i+1] <= t) i++;\n`
          lines += `            if (i >= n-1) ${p}_val = kv[n-1];\n`
          lines += `            else { uint32_t a=kt[i], b=kt[i+1]; int u=(int)((t-a)*1000/(b-a)); ${p}_val = kv[i] + (kv[i+1]-kv[i])*u/1000; }\n`
          lines += `        }\n`
          return { decl: lines, ref: `${p}_val` }
        }
        return { decl: '', ref: String(Math.round(((el as any)[p] ?? 0))) }
      }
      if (el.kind === 'ellipse') {
        const X = sample('x'), Y = sample('y'), W = sample('w'), H = sample('h')
        s += `        {\n${X.decl}${Y.decl}${W.decl}${H.decl}            fill_ellipse(${X.ref}, ${Y.ref}, ${W.ref}/2, ${H.ref}/2, ${hex});\n        }\n`
      } else if (el.kind === 'rect') {
        const X = sample('x'), Y = sample('y'), W = sample('w'), H = sample('h')
        s += `        {\n${X.decl}${Y.decl}${W.decl}${H.decl}            fill_rect(${X.ref}, ${Y.ref}, ${W.ref}, ${H.ref}, ${hex});\n        }\n`
      } else if (el.kind === 'arc') {
        const X = sample('x'), Y = sample('y'), R = sample('r'), T = sample('thick')
        s += `        {\n${X.decl}${Y.decl}${R.decl}${T.decl}            draw_mouth_arc(${X.ref}, ${Y.ref}, ${R.ref}, ${T.ref}, ${hex});\n        }\n`
      }
    }
    s += '        break;\n    }\n'
  }
  s += '    default: break;\n    }\n}\n'
  return s
}
