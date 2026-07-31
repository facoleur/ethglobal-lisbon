# Video design guidelines — Chateau pitch

## Typography

- **Font**: Figtree (Google Fonts). Fallback: Inter.
- **No uppercase text** — ever. Neither CSS `text-transform: uppercase` nor manually uppercased strings.
- **No letter-spacing / tracking** — never set `letterSpacing`, always use the font default.
- **Text sizes**: large and impactful — roughly 2–3× bigger than typical UI defaults.
  - Big headline: ~240px
  - Body / subtitles: ~90px
  - Diagram labels: ~28–36px
  - Box labels: ~32px
  - Small annotations: ~24px

## Colors

| Role | Value |
|---|---|
| Background | `#000000` (pure black) |
| Primary text | `#CCCCCC` |
| Bright text | `#FFFFFF` |
| Accent (≤10 % of visible area) | `#D9C314` |
| Box background (primary) | `#333333` |
| Box background (dim) | `#2A2A2A` |
| Muted / labels | `#555555` |

## Shapes & layout

- **No borders** on any element.
- **Rounded radius**: 14–16 px on boxes.
- **Actor boxes**: square, not rectangular.
- **Background**: pure black (`#000000`). Use a PNG background image if needed.

## Animation

- **Actors must be animated** — translate, scale, rotate. No purely static elements.
- **Easing**: fast, bezier-heavy. Default ease-out: `Easing.bezier(0.16, 1, 0.3, 1)`.
- **Transitions between scenes**: slide or swipe.
- **Arrows**: always SVG paths / `<line>` / `<polygon>`. Never text characters like `->` or font glyphs.
- **Remotion rules**: drive everything with `useCurrentFrame()` + `interpolate()`. Never use CSS `transition` or `animation`.

## Audio

- **No background music.**
- Voice-over files are added externally (dropped into `public/`) and embedded with `<Audio>`.

## Diagram conventions

- Stake icon: Ξ (ETH symbol) as a filled circle with text, positioned on or very close to the relevant arrow.
- Dashed lines (`strokeDasharray="8 6"`) for monitoring / off-chain links.
- Solid lines with animated `strokeDashoffset` reveal for transactional arrows.
- Panel context label (e.g. "Reality", "What people see"): top-left corner, sentence case, muted color, ~24 px.
