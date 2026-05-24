# Atticus Face Editor

A single-file web tool for designing Leo's (StackChan) face. Vector primitives (ellipse, rect, arc), keyframe animation, multiple expressions, exports both **JSON face-specs** and **drop-in C code** for `face_anim.c`.

Open `index.html` in any modern browser. No build, no install.

## Features

- 320×240 canvas at 2× zoom — matches the ILI9342C panel exactly
- Six seeded expressions ported from the firmware (Neutral, Happy, Curious, Thinking, Listening, Sleeping) + a "Blinking" demo with real keyframes
- Add / delete / duplicate expressions
- Add ellipse, rect, or arc elements; drag on canvas, arrow keys nudge (shift = 10px)
- Per-element color picker
- Per-property keyframe tracks (x, y, w, h, r, thick, start, end, color); diamond button adds a keyframe at the current playhead time
- Play / pause / scrub timeline for animation preview
- Save to / load from browser localStorage
- Import JSON, Export JSON, Export C code
- "Push to Leo" button (stubbed — needs bridge `/face` endpoint, see below)

## Data model

```json
{
  "version": 1,
  "width": 320, "height": 240,
  "background": "#000000",
  "expressions": [
    {
      "id": "neutral", "name": "Neutral",
      "duration": 0,
      "elements": [
        { "id": "...", "kind": "ellipse", "x": 100, "y": 100, "w": 56, "h": 72, "color": "#f3ead9", "keyframes": {} }
      ]
    }
  ]
}
```

`duration` is the animation loop length in ms (0 = static). Keyframes per property are `[{t, v, easing?}]`. Easings: `"linear"` (default), `"easeInOut"`.

## How it fits the firmware

The editor's vector primitives are 1:1 with the firmware's drawing primitives in `face_anim.c`:

- ellipse → `fill_ellipse(cx, cy, rx, ry, color)`
- rect    → `fill_rect(x, y, w, h, color)`
- arc     → `draw_mouth_arc(cx, cy, r, thick, color)`

The **Export C code** button emits a complete `face_render_expression()` function ready to paste in. Animation keyframes are emitted as in-place lerp tables — no runtime alloc, lives on stack.

## Next: live push to Leo

Planned endpoint on the bridge:

```
POST /face
Authorization: Bearer <token>
Content-Type: application/json
{ "expression": "happy", "doc": <full doc> }
```

Bridge will forward via an opcode (0x11) to firmware. Firmware will run a small face-spec interpreter and render. That way you tweak in the editor, hit "Push", see it on Leo's face. No reflash.

For now, exports unblock you: export C, paste into `face_anim.c`, rebuild, flash.

## Local dev

```bash
cd /Users/saberzou/OpenClawProjects/atticus/atticus-face-editor
python3 -m http.server 8081
# open http://localhost:8081
```

Or just `open index.html`.
