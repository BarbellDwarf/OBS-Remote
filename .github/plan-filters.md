# Plan: Source Filters Control
- **Goal**: View/toggle filters on sources and adjust basic settings.
- **Dependencies**: OBS APIs GetSourceFilterList, SetSourceFilterEnabled, SetSourceFilterSettings.
- **Steps**:
  1. Add Filters drawer per source listing filters with enabled toggles.
  2. For common types (gain, color correction, crop, limiter), render simple controls and push updates via SetSourceFilterSettings.
  3. Refresh filters on scene/source change and after edits; handle errors with user feedback.
  4. Keep UI responsive and reflect current enabled state.

