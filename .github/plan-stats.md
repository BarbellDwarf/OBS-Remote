# Plan: Enhanced Statistics
- **Goal**: Add stream/record uptime, recording duration, total data sent/received, network health, frame drop trend, audio clipping indicator.
- **Dependencies**: Stats poll loop; OBS APIs GetStreamStatus, GetRecordStatus, GetStats; settings for update frequency and thresholds.
- **Steps**:
  1. Track start timestamps for stream/record to compute uptime/duration; reset on stop events.
  2. Display total bytes sent/received and derive bitrate from deltas.
  3. Network health badge from congestion/dropped frames ratio and (if available) round-trip; color-coded states.
  4. Frame drop trend sparkline over recent samples.
  5. Audio clipping warning based on peak threshold; per-source badge.
  6. Expose stats update frequency and alert thresholds in settings.
