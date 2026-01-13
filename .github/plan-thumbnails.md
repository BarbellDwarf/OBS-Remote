# Thumbnail Implementation Plan

## Objective
Add lightweight scene thumbnails to the Scenes list to make scene selection faster and more visual without impacting app responsiveness.

## Scope
- Use the OBS WebSocket `GetSourceScreenshot` request to grab small (e.g., 240×135) snapshots for each scene.
- Cache thumbnails per scene for the session; refresh when scenes change, collections switch, or on manual refresh.
- Graceful fallback: show an icon placeholder on errors or when screenshots are unavailable.
- Keep UI responsive: fetch thumbnails asynchronously, limit concurrency/rate, and avoid blocking scene switching.
- Do not add video streaming or full preview windows.

## Implementation Steps
1. **Data Layer**
   - Add a helper to request scene screenshots with width/height and format parameters.
   - Implement error handling and timeouts; return `null` on failure.
   - Store thumbnails in an in-memory map keyed by scene name; clear on disconnect.
2. **UI Updates**
   - Extend scene list items with a 16:9 thumbnail box.
   - Show loading/skeleton state while fetching; fallback icon when unavailable.
   - Preserve existing active/hover styling.
3. **Lifecycle Hooks**
   - Trigger thumbnail fetch after scenes load/refresh and when the active scene changes.
   - In studio mode, keep thumbnails synced with preview/program scene changes.
   - Clear thumbnails when switching scene collections or profiles.
4. **Performance & Safety**
   - Limit concurrent screenshot requests (e.g., 2 at a time) and debounce reloads.
   - Cap image dimensions to keep base64 sizes small.
   - Avoid repeated fetches if a thumbnail already exists unless a refresh is requested.
5. **Testing & Validation**
   - Manual QA: connect to OBS with multiple scenes; verify thumbnails render quickly and update after scene edits.
   - Verify fallback state when screenshots are disabled or fail.
   - Run existing verification/build scripts to ensure no regressions.

## Acceptance Criteria
- Scenes display thumbnails (or a clear placeholder) within a couple of seconds after connecting.
- The app remains responsive while thumbnails load; scene switching is unaffected.
- No unhandled errors if OBS refuses screenshots or a scene lacks renderable sources.
- Thumbnails update after scene list changes or collection/profile switches.
# Plan: Scene Preview Thumbnails
- **Goal**: Provide hover/click thumbnails for scenes via GetSourceScreenshot with low-frequency refresh and user toggle.
- **Dependencies**: OBS GetSourceScreenshot; rate limiting; settings to enable/disable and cadence.
- **Steps**:
  1. On hover or “refresh” click, fetch screenshot per scene; cache with timestamp and fallback placeholder.
  2. Background refresh every N seconds (default ~10s) when enabled; throttle failures.
  3. Add “disable thumbnails” setting and cadence slider; gracefully degrade if API unsupported.
  4. Render constrained-size previews with loading state.

