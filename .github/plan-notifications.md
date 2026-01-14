# Plan: Notifications System
- **Goal**: In-app toasts for stream/record start/stop, connection lost/restored, errors, and scene change confirmations.
- **Dependencies**: Existing event forwarding; toast component; settings toggles per category.
- **Steps**:
  1. Build toast queue with severity levels and auto-dismiss; accessible (aria-live).
  2. Subscribe to OBS events: StreamStateChanged, RecordStateChanged, ExitStarted, CurrentProgramSceneChanged, ConnectionClosed/Opened, error handlers.
  3. Add settings toggles for notification categories; support do-not-disturb mode.
  4. Ensure deduping/throttling to avoid spam.

