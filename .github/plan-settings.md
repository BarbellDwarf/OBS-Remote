# Plan: Settings / Preferences Panel
- **Goal**: Centralize user-configurable options (polling/theme/auto-reconnect/db range/stats frequency, default connection, shortcuts map).
- **Dependencies**: Local storage schema versioning; IPC bridge for persistent settings; existing settings load/save helpers.
- **Steps**:
  1. Define settings schema with defaults and validation (poll intervals, dB min/max, stats freq, theme/accent palette, auto-reconnect toggle, default connection id, keyboard shortcut map).
  2. Build settings UI (modal/drawer) to edit values; persist to localStorage; live-apply CSS vars for theme and reinitialize timers and meter ranges on change.
  3. Wire auto-reconnect and default connection into connection lifecycle; expose reconnect delay/jitter.
  4. Add shortcut editor that writes to shortcut map; provide reset-to-defaults and import/export JSON.

