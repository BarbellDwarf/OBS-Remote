# Plan: Layout Presets
- **Goal**: Save/load UI layout presets and offer compact vs expanded modes.
- **Dependencies**: DOM layout state serialization; CSS classes for density modes; localStorage persistence.
- **Steps**:
  1. Define layout schema (panel visibility, widths, order, density/theme flags).
  2. Add save/load/delete preset UI; persist in localStorage; seed default presets (Compact, Expanded).
  3. Apply presets by toggling CSS classes and restoring panel positions; make resilient to missing elements.
  4. Provide reset-to-default option.

