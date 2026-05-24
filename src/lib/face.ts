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
  const eyeY = LCD_H / 2 - 20
  const eyeLX = LCD_W / 2 - 60
  const eyeRX = LCD_W / 2 + 60
  const er = 28, ery = 36
  const mx = LCD_W / 2, my = LCD_H / 2 + 50

  const eye = (role: string, cx: number, cy: number, w: number, h: number): FaceElement => ({
    id: uid(), role, name: role === 'leftEye' ? 'Left Eye' : 'Right Eye',
    kind: 'ellipse', x: cx, y: cy, w: w * 2, h: h * 2, color: DEFAULT_COLORS.EYE, keyframes: {},
  })
  const closedEye = (role: string, cx: number, cy: number, w: number): FaceElement => ({
    id: uid(), role, name: role === 'leftEye' ? 'Left Eye' : 'Right Eye',
    kind: 'rect', x: cx - w, y: cy - 3, w: w * 2, h: 6, color: DEFAULT_COLORS.EYE, keyframes: {},
  })
  const mouth = (r = 24): FaceElement => ({
    id: uid(), role: 'mouth', name: 'Mouth',
    kind: 'arc', x: mx, y: my, r, thick: 5, start: 0, end: 180, color: DEFAULT_COLORS.MOUTH, keyframes: {},
  })

  const blinkKf = (openH: number): Track => [
    { t: 0, v: openH }, { t: 1800, v: openH },
    { t: 1900, v: 6 }, { t: 2000, v: openH }, { t: 4000, v: openH },
  ]

  return {
    version: 3, width: LCD_W, height: LCD_H, background: DEFAULT_COLORS.BG,
    expressions: [
      { id: 'neutral', name: 'Neutral', duration: 0, elements: [eye('leftEye', eyeLX, eyeY, er, ery), eye('rightEye', eyeRX, eyeY, er, ery), mouth(24)] },
      { id: 'happy', name: 'Happy', duration: 0, elements: [eye('leftEye', eyeLX, eyeY + 6, er, ery / 2), eye('rightEye', eyeRX, eyeY + 6, er, ery / 2), mouth(36)] },
      { id: 'curious', name: 'Curious', duration: 0, elements: [eye('leftEye', eyeLX, eyeY, er, ery), eye('rightEye', eyeRX, eyeY, er + 4, ery + 6), mouth(24)] },
      { id: 'thinking', name: 'Thinking', duration: 0, elements: [eye('leftEye', eyeLX + 6, eyeY - 4, er, ery), eye('rightEye', eyeRX + 6, eyeY - 4, er, ery), mouth(24)] },
      { id: 'listening', name: 'Listening', duration: 0, elements: [eye('leftEye', eyeLX, eyeY + 2, er, ery), eye('rightEye', eyeRX, eyeY + 2, er, ery), mouth(24)] },
      { id: 'sleeping', name: 'Sleeping', duration: 0, elements: [closedEye('leftEye', eyeLX, eyeY, er), closedEye('rightEye', eyeRX, eyeY, er)] },
      {
        id: 'blinking', name: 'Blinking', duration: 4000, elements: [
          { id: uid(), role: 'leftEye', name: 'Left Eye', kind: 'ellipse', x: eyeLX, y: eyeY, w: er * 2, h: ery * 2, color: DEFAULT_COLORS.EYE, keyframes: { h: blinkKf(ery * 2) } },
          { id: uid(), role: 'rightEye', name: 'Right Eye', kind: 'ellipse', x: eyeRX, y: eyeY, w: er * 2, h: ery * 2, color: DEFAULT_COLORS.EYE, keyframes: { h: blinkKf(ery * 2) } },
          mouth(24),
        ],
      },
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
