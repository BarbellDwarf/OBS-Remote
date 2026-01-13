# Feature Delivery Plans

## 1) Settings / Preferences Panel
- **Goal**: Centralize user-configurable options (polling rates, themes, defaults, shortcuts, ranges, auto-reconnect).
- **Dependencies**: Local storage schema versioning; IPC bridge for persistent settings; existing settings load/save helpers.
- **Plan**:
  - Add settings model with defaults and validation (polling intervals, dB ranges, stats freq, theme/accent palette, auto-reconnect toggle, default connection, keyboard shortcuts map).
  - Build UI panel (modal or drawer) to edit settings; persist to localStorage; apply live updates (CSS vars for theme, polling timers reset, meter range recalculated).
  - Wire auto-reconnect and default connection to connection lifecycle; expose reconnect delay/jitter.
  - Surface keyboard shortcut editor (per-action bindings) writing to shortcut map.
  - Add “reset to defaults” and import/export (JSON).

## 2) Hotkey Support
- **Goal**: Keyboard controls for scenes (1-9), stream/record/studio toggles, transitions, volume, mute.
- **Dependencies**: Settings shortcut map; focus management to avoid colliding with form fields; IPC/renderer OBS calls already present.
- **Plan**:
  - Implement global key listener with enable/disable toggle from settings.
  - Map keys to OBS actions: scene switch (GetSceneList cached), Start/StopStream, Start/StopRecording, ToggleStudioMode, TriggerTransition, volume up/down for focused source, mute/unmute focused source.
  - Add visual hint/tooltip for active bindings; prevent repeat when key held; respect modal focus.
  - Persist bindings in settings; provide conflict detection and restore defaults.

## 3) Enhanced Statistics
- **Goal**: Add uptime (stream/record), recording duration, data sent/received, network health indicator, frame drop trend, audio clipping indicator.
- **Dependencies**: Existing stats poll interval; OBS APIs: GetStreamStatus, GetRecordStatus, GetStats.
- **Plan**:
  - Track start timestamps to compute uptime/duration; reset on stop events.
  - Display total bytes sent/received (from GetStats) and compute delta rate.
  - Network health: derive from congestion/dropped frames ratio + round-trip (if available); color-coded badge.
  - Frame drop trend: small sparkline over window of recent samples.
  - Audio clipping: threshold on peak meters; show warning badge per source.
  - Settings: stats update frequency and alert thresholds.

## 4) Scene Preview Thumbnails
- **Goal**: Hover/click thumbnails for scenes via GetSourceScreenshot with low-frequency refresh and user toggle.
- **Dependencies**: OBS GetSourceScreenshot; rate limiting to avoid load; settings to enable/disable and cadence.
- **Plan**:
  - On hover or “refresh” click, fetch screenshot for scene’s program/preview sources; cache per scene with timestamp.
  - Background refresh every N seconds (configurable, default 10s) when enabled.
  - Add “disable thumbnails” setting; degrade gracefully if API unsupported.
  - Display loading/fallback states; size-constrained previews.

## 5) Source Filters Control
- **Goal**: View and toggle filters on sources; adjust basic settings.
- **Dependencies**: OBS APIs: GetSourceFilterList, SetSourceFilterEnabled, SetSourceFilterSettings.
- **Plan**:
  - Add Filters drawer per source listing filters with enabled toggle.
  - For basic types (gain, color correction, crop, limiter), render simple inputs and push updates via SetSourceFilterSettings.
  - Refresh filters on scene/source change and on edits; handle errors gracefully.

## 6) Browser Sources Control
- **Goal**: View/refresh browser source URLs; reload button.
- **Dependencies**: OBS API: GetInputSettings, SetInputSettings, PressInputPropertiesButton (if needed).
- **Plan**:
  - Detect browser sources by kind; show current URL (read-only by default).
  - Provide “Reload” action (refresh cache) and optional “Update URL” field with apply button.
  - Confirm before changing URL; persist via SetInputSettings; reload after update.

## 7) Notifications System
- **Goal**: In-app toasts for stream/record start/stop, connection lost/restored, errors, scene change confirmation.
- **Dependencies**: Existing event forwarding; toast component; settings for notification toggles.
- **Plan**:
  - Build toast/notification queue with severity levels and auto-dismiss.
  - Subscribe to OBS events: StreamStateChanged, RecordStateChanged, ExitStarted, CurrentProgramSceneChanged, ConnectionClosed/Opened, error handlers.
  - Add settings toggles for categories; ensure accessibility (aria-live).

## 8) Layout Presets
- **Goal**: Save/load UI layout presets (positions/visibility) and offer compact vs expanded modes.
- **Dependencies**: DOM layout state serialization; CSS classes for compact/expanded; localStorage persistence.
- **Plan**:
  - Define layout schema (panel visibility, widths, order, theme density).
  - Add save/load/delete preset UI; store in localStorage; default presets: Compact (mobile-friendly) and Expanded (desktop).
  - Apply presets by toggling CSS classes and restoring panel positions; ensure resilience if elements change.
