# DESIGN.md — Atticus Face Studio

## Visual register

Warm dark editorial workshop. Not a tool chrome, not SaaS, not "AI gradient." All neutrals are tinted toward warm orange (chroma 0.012–0.020 in OKLCH). The active accent is a saturated peach-orange around `oklch(0.78 0.18 55)`. There is no second accent color — emphasis is by **weight**, **size**, and **the one orange**.

The scene sentence: *Atticus, in a warm studio at 11pm, tuning Leo's blink on a phone. The room is amber, the LCD is on the desk, the editor is the workbench.*

## Color tokens

All defined in `tailwind.config.js`. Always reference by name; never inline hex.

| Token | OKLCH | Use |
|---|---|---|
| `bg` | `0.16 0.012 55` | App canvas, default surface behind everything |
| `bg-deep` | `0.11 0.010 55` | Inspector body, stage shadow, modal scrim base |
| `surface` | `0.20 0.014 55` | Card-like clusters, input default |
| `surface-2` | `0.24 0.016 55` | Hovered/raised tier |
| `line` | `0.30 0.020 55` | All separators, default borders |
| `ink` | `0.96 0.012 80` | Primary text — high-contrast, never `#fff` |
| `ink-dim` | `0.74 0.014 70` | Secondary text, labels |
| `ink-faint` | `0.55 0.014 65` | Metadata, monospace stamps |
| `orange` | `0.78 0.18 55` | The single accent: selection, focus, active tab pill, brand glyph |
| `orange-deep` | `0.66 0.21 45` | Orange gradient end / hover deepening |
| `good` | `0.78 0.16 145` | Live-Mirror connected, keyframe diamonds |
| `bad` | `0.68 0.20 25` | Destructive hover, error toast |

Rules:
- Never use `#000` or `#fff`. Don't introduce neutral grays without warm chroma.
- Gray text on a colored background is banned. On orange surfaces, use the deep `oklch(0.18 0.05 50)` family.
- The accent is restrained-strategy: orange covers ≤10% of any screen at a time. It marks selection, focus, primary actions, and the brand glyph — nothing else.

## Typography

Three families. No fourth.

- **Display:** Instrument Serif, italic permitted, for the wordmark and one editorial flourish per panel (e.g. expression name, modal titles). Sized large (`text-xl`/`text-2xl`); never set in body copy.
- **Sans:** Sora. Body, buttons, labels, sidebar. Weights 400, 500, 600.
- **Mono:** JetBrains Mono. **All numeric values, IDs, telemetry, keyframe times.** Mono = "this is data."

Scale (modular, ratio ~1.25 by step):
- 10px uppercase tracked labels (font-mono, `tracking-wider`, `tracking-[0.2em]` for section headers)
- 11px small metadata
- 12–13px body
- 16px input (iOS no-zoom floor — non-negotiable)
- 18–24px display

Hierarchy is **scale × weight contrast ≥ 1.25**, never color-only. Never gradient-clip text.

## Spacing

Tailwind defaults (4px base). Stick to `1, 1.5, 2, 2.5, 3, 4, 5, 6` — anything else is suspicious. Vary spacing for rhythm; never repeat the same padding across every container.

Inspector inner padding: `p-3` mobile, `p-4` desktop. Stage padding: `p-3 md:p-5`. Sticky strip vertical padding: `py-2.5`. Status bar: `py-2`.

## Layout

- **No nested cards.** A surface inside a surface inside a surface is always wrong.
- **No side-stripe accent borders.** Selection uses full 1px `border-orange` + subtle inset glow, not a 3px left edge.
- **Single source of truth for navigation.** Expression switcher is a top strip directly under the header at every breakpoint. Mobile inspector has no tabs.
- **Mobile:** `flex h-[100dvh]` column. Header → Expression strip → Stage (flex-1) → Transport bar → Inspector panel (fixed 48dvh, scrolls internally).
- **Desktop:** same top stack, but body is `grid-cols-[1fr_22rem]` with stage left, inspector as a right rail.
- Everything clamps `max-w-[100vw] overflow-hidden` on the outer column. Internal horizontal scroll is opt-in only (expression strip).

## Components

- **Buttons.** Three variants: `primary` (orange fill, deep ink text), `default` (surface fill, ink-dim text), `outline` (transparent, line border). All ≥36px tall, ≥44px on mobile (`min-h-9` is the floor). Icon buttons are square. Active state: `scale-[0.97]` press, no bounce.
- **Slider (Radix).** Track is `line`, range is `orange`, thumb is a 16px orange circle with thin white ring. Disabled = `surface-2` + `opacity-50`.
- **NumberField.** Resting: right-aligned mono in `surface/60` with `line` border. Tap: replaces with `<input type=number>` (`inputMode=numeric`), pre-selected, orange border. Commit on Enter or blur. Esc reverts. Used for every numeric value in the app.
- **Accordion part row.** Header is `flex` with swatch + name + kind stamp + chevron. Active = `border-orange` + faint orange bg + `shadow-glow`. Expanding shows the property grid inline; no separate pane.
- **Tabs (Radix).** Reserved for modals; not used in the main inspector.
- **Dialog (Radix).** Backdrop is `bg-bg-deep/80 backdrop-blur-sm`. Content is `surface` with `line` border and 12px radius. Used only for Import/Export.
- **Toast.** Centered bottom pill, orange fill, deep-ink text, ALL-CAPS mono, 1.6s. No icons.

## Motion

- All hover/active transitions 150ms `ease-out-quart`.
- Accordion expand: native `display: block` toggle (no layout animation — animating height on a panel that contains inputs is jank).
- Live Mirror pulse: 2s `livePulse` keyframes, expanding box-shadow ring on the `good` dot.
- Toast: 250ms slide-up + fade.
- **No bounce, no elastic, no spring.** Ever.
- Respect `prefers-reduced-motion` (currently relies on Radix defaults; revisit during harden pass).

## Interaction states (every interactive element gets all of these)

| State | Treatment |
|---|---|
| Default | As tokenized above |
| Hover (desktop) | Border shifts to `ink-faint` or `orange`, text to `ink` |
| Focus | 2px `orange` outline offset 2px, never removed |
| Active/Press | `scale-[0.97]` for buttons; tactile press, no other movement |
| Disabled | `opacity-50`, no border shift, `cursor-not-allowed` |
| Selected | `border-orange` + `shadow-glow` + brighter text |

## Iconography

`lucide-react` only. 14–16px in dense rows, 20px in toolbar. Stroke 2. No icon tiles above headings. Keyframe markers are `Diamond` filled in `good` when set, outlined in `ink-faint` when empty — that's the visual vocabulary.

## Voice

Already in PRODUCT.md. Dry, short, lowercase for affirmations. Buttons use Title Case sparingly: `Save`, `Load`, `Live Mirror`, `Duplicate`, `Delete`. Section labels are SMALL-CAPS uppercase mono.

## Absolute bans (impeccable laws applied)

Refuse if I'm about to write any of these:
- `#000`, `#fff`, untinted gray
- `border-left`/`border-right` ≥ 2px as accent
- `background-clip: text` gradient text
- Glassmorphism by default
- Hero-metric template
- Identical card grids
- Modal as first thought (we use them only for JSON/C blob views)
- Em dashes or `--` in UI copy
- Bouncy / elastic motion

## Open

- The brand orange could push slightly hotter (`chroma 0.20+`) at the wordmark only, for emphasis. Audit later.
- Dark theme is currently the only theme. A light "studio daylight" mode is not planned.
