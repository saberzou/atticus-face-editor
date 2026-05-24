# Atticus Face Studio

Direct-manipulation editor for StackChan / atticus-body faces. Vector primitives (ellipse, rect, arc), per-property keyframe animation, JSON + C export, optional Live Mirror push to bridge.

**Live:** https://saberzou.github.io/atticus-face-editor/

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
