# Layout Implementation Plan

## Purpose
This plan keeps the OBS Remote Control interface consistent with the documented visual guide and design specs. It focuses on the structural layout (header, sidebars, center panel) and responsive behavior rather than business logic.

## Layout Structure
- **Header Bar**: Connection inputs (host, port, password), Connect/Disconnect button, and status dot aligned on a single row.
- **Left Sidebar**: Scenes list, sources list, and transitions controls stacked vertically.
- **Center Panel**: Studio mode toggle, preview/program placeholders, stream/record controls, and statistics grid.
- **Right Sidebar**: Audio mixer cards and recordings list with refresh.
- Use the existing 3-column grid: left (nav), center (controls), right (audio/recordings).

## Responsive & Sizing Rules
- Minimum window size: **1000x600**.
- Breakpoints: **1400px+** full layout, **1200–1399px** compressed sidebars, **<1200px** adjusted grids with scroll as needed.
- Sidebars shrink proportionally; center panel keeps priority width. Stats grid reflows on smaller widths.

## Visual & Interaction Guardrails
- Dark theme palette (#1e1e1e/#252525 with #0084ff accents) and Inter font.
- 12px spacing rhythm; maintain consistent padding and card spacing.
- Hover/active states: soft lift on hover, clear focus outlines, muted buttons turn red, active scene has blue accent border.
- Accessibility: readable contrast (WCAG AA), keyboard focusable controls, labels for inputs and buttons.

## Implementation Steps
1. **Grid/Foundation**: Keep the 3-column layout using existing grid/flex patterns in `index.html` and `styles.css`.
2. **Header**: Ensure single-row alignment for inputs, connect button, and status indicator with consistent gaps.
3. **Panels**: Maintain vertical stacking in sidebars and centered preview/program/stats sections; preserve button group alignment.
4. **Responsive Rules**: Apply breakpoint-specific widths and overflow handling for sidebars and stats grid; enforce min sizes.
5. **States & Accessibility**: Verify connected/disconnected visuals, hover/active styling, focus outlines, and readable labels.

## Acceptance Checklist
- Layout matches the Visual Guide structure (header + left/center/right columns).
- Breakpoints behave as specified; no layout breakage at 1000x600.
- Colors, spacing, and focus states follow the documented theme.
- Audio mixer cards and recordings list remain usable at all sizes.
- No new layout regressions introduced in `index.html` or `styles.css`.
