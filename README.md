# Atticus Face Studio

Direct-manipulation editor for StackChan / atticus-body faces. Vector primitives (ellipse, rect, arc), per-property keyframe animation, JSON + C export, optional Live Mirror push to bridge.

**Live:** https://saberzou.github.io/atticus-face-editor/

## v4 — Grid-snap editor (May 2026)

All spatial editing happens on the canvas, snapped to a 64×48 pixel grid (5px cells over the 320×240 face). Under the hood, output is still parametric — ellipses have `cx/cy/rx/ry`, the grid is just a snapping/input system. The C renderer on Leo doesn't know it exists.

Interaction:
- Tap an `+ ellipse / + rect / + arc` button to arm placement, then tap the canvas to drop it (snapped).
- Tap a part on the canvas to select it; drag the body to move (snapped); drag a corner handle to resize (snapped).
- **Sym** toggle: mirrors edits across the vertical centerline by role pairing (`leftEye`↔`rightEye`, `leftBrow`↔`rightBrow`). On by default.
- **Grid** toggle hides the overlay for clean preview.
- Selected + arrow keys nudges by 1 cell (Shift = 4 cells). Backspace deletes.
- Long-press / tap any numeric field in the inspector to type an exact value (sub-cell escape hatch).
- Per-property keyframes (`x/y/w/h/r/thick/start/end/color`) are toggled with the diamond buttons inside the expanded part row; the value is recorded at the current playhead.

Deprecated from v3.x: spatial sliders (x/y/w/h/r…), Parts vs. Properties split, modal expression tabs.

## Local dev
```
pnpm install
pnpm dev      # http://localhost:5173/atticus-face-editor/
pnpm build    # static output to dist/
```

## Stack
Vite + React 18 + TypeScript + Tailwind 3 + Radix UI primitives. Single-page app, no backend.

## Deploy
Push to `main` → GitHub Actions builds and deploys to Pages (`.github/workflows/deploy.yml`).
