# RatedNews design tokens

## Type scale (use these, not in-between values)
- 10px — uppercase kickers/category labels (letterSpacing 0.05–0.08em, weight 700)
- 11px — meta text, timestamps, widget titles (uppercase)
- 12px — secondary UI (buttons, chips, rail rows)
- 13px — primary UI text, nav, list rows
- 14px — body/summaries (line-height 1.6+)
- 16px — card headlines (Playfair, weight 500–600)
- 20px — section headings (Playfair, weight 700)
- 26–27px — page titles / article headlines (Playfair)

## Color roles (CSS variables only — never hardcode)
- var(--text)   headline / primary
- var(--text2)  body / secondary
- var(--text3)  meta / disabled
- var(--coral)  action, active state, brand accent — one accent per view
- var(--green)/--green-dark  community score ONLY (semantic, not decorative)
- Surfaces: --bg (page) < --bg2 < --surface (cards). Borders: --border, --border2.

## Layout
- Shell: .container (1100 default; 1240 for grid pages)
- Grid pages: .grid = content | 300px .sidebar (sticky ≥1024px)
- Breakpoints: 768px (mobile chrome), 1024px (desktop grid + rails)
- Rails: .widget boxes; lead with 🔥 trending where applicable
- Filters that engage show ✕ Clear in the widget header (ClearButton)

## Components (src/components/ui.jsx)
Widget, WidgetTitle (with optional action), ClearButton, SectionHeading, Meta.
New code uses these; old inline styles migrate when touched.
