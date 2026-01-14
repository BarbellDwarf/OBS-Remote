# Plan: Browser Sources Control
- **Goal**: View/refresh browser source URLs and provide reload/update actions.
- **Dependencies**: OBS APIs GetInputSettings, SetInputSettings, PressInputPropertiesButton (if needed).
- **Steps**:
  1. Detect browser sources by kind; display current URL (read-only by default).
  2. Provide “Reload” action; optional URL edit field with apply and confirmation.
  3. Persist URL changes via SetInputSettings; reload after update; handle errors gracefully.
  4. Refresh browser source list on scene changes to keep URLs in sync.
