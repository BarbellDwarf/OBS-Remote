# Plan: Scene Preview Thumbnails
- **Goal**: Provide hover/click thumbnails for scenes via GetSourceScreenshot with low-frequency refresh and user toggle.
- **Dependencies**: OBS GetSourceScreenshot; rate limiting; settings to enable/disable and cadence.
- **Steps**:
  1. On hover or “refresh” click, fetch screenshot per scene; cache with timestamp and fallback placeholder.
  2. Background refresh every N seconds (default ~10s) when enabled; throttle failures.
  3. Add “disable thumbnails” setting and cadence slider; gracefully degrade if API unsupported.
  4. Render constrained-size previews with loading state.

