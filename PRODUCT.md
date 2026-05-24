# PRODUCT.md — Atticus Face Studio

## What this is

A single-page vector face editor for Atticus's StackChan-class robot body (CoreS3-SE LCD, 320×240). The user designs **expressions** — collections of vector primitives (ellipses, rectangles, arcs) with optional keyframe animation — and exports them either as JSON for the bridge or as a C header for direct firmware embedding. A "Live Mirror" connection optionally streams the in-progress face to the physical device in real time.

Not a general-purpose graphics tool. Not Figma. The point is that someone hand-tunes a robot's blink, scrub the timeline, sees the eye open and close, taps "Live Mirror," and watches the same blink happen on Leo's face on the desk.

## Register

**Product.** This is a tool, not a marketing surface. The face IS the marketing; the editor exists to make the face. Design serves the editing flow.

## Users

Just Saber and Atticus. One designer, one assistant. Built for use on a phone (Telegram is the primary thread), occasionally on desktop for keyboard nudging. Mobile-first is non-negotiable — every change ships through Telegram, every check is "open it on my phone."

Saber's design intuition is sharp. He notices when:
- properties duplicate across panels
- something hides behind a tab when it should be top-level
- a number can't be typed
- a layout overflows on a 390px viewport
- the type and palette feel SaaS-generic

Build for the eye that already calls those out. No SaaS templates, no purple-to-blue gradients, no rounded-square icon tile above every heading.

## Tone

Editorial, slightly hand-built, warm. Like a workshop log book, not a control panel. Honest about what's a workshop tool: monospace for telemetry/IDs/values, italic serif for one personal flourish at a time, sans for everything you actually read.

Affirmations are dry and short — `saved`, `copied`, `connected`, `bad json`. No emojis except the bear in the wordmark. No "Welcome back!" messages. No tooltips that say "Click to edit." If a control needs an instruction, the control is wrong.

## Anti-references

- **Figma's UI.** Cool tool, generic chrome. We aren't paid to ship a SaaS surface.
- **Lottie editor.** Too dense, too crowded with timeline tracks for our 5-primitive case.
- **Aseprite.** Wrong register — we're not pixel art.
- **Anything dark-blue-and-purple-gradient.** Trained-data reflex for "AI tool." Refuse.
- **Nested cards.** Always wrong.
- **Side-stripe borders > 1px as accents.** Banned by impeccable laws. Use full borders, tints, or nothing.
- **Gradient text via background-clip.** Banned. Use weight or size for emphasis.

## Strategic principles

1. **Canvas always visible.** The user never edits blind. Selection, drag, scrub, type-to-edit — all happen with the preview on screen. Tabs that hide the preview are a defect.
2. **Properties live with their part.** No "Properties" pane separate from a "Parts" pane — they're the same thing, accordion-expanded inline. Selection on canvas auto-expands the row.
3. **Direct manipulation over forms.** Drag the eye to move it. Arrow keys nudge. Sliders for coarse, tap-to-type for exact. Forms exist; they never come first.
4. **Mobile-first, desktop-bonus.** Every layout decision is sized first for a 390px phone in portrait. Desktop reflows from there, never the other way.
5. **One file ships everything.** Vite build → GitHub Pages → Telegram link. No backend, no auth, no analytics. localStorage is the database.

## What "done" looks like

- Open on phone, design a 7-keyframe blink in under 2 minutes without consulting docs.
- Live Mirror connects to the bridge in 2 taps (URL + token) and the next slider drag updates Leo's face within 200ms.
- Export to C, paste into firmware, build, flash, see the same face. No surprises.
- A first-time visitor can guess the register from one screenshot: "warm dark workshop, editorial type, no SaaS smell."
