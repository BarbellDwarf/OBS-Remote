# Notification Experience Plan

## Purpose
Create a concise, non-intrusive notification experience that keeps users aware of important OBS events (connection state, streaming/recording status, errors) while avoiding noise or distraction during live production.

## Goals
- Provide immediate, clear feedback for critical actions (connect/disconnect, start/stop stream or recording, failures).
- Surface health issues early (dropped frames/bitrate-drops, high CPU) with gentle warnings.
- Respect user focus by allowing optional desktop/system notifications when the window is unfocused.
- Keep implementation lightweight and consistent with the existing dark UI style.

## Non-Goals
- Building a long-lived notification history center.
- Adding a server-side notification service or push infrastructure.
- Delivering SMS/email alerts.

## Notification Triggers (v1)
- Connection lifecycle: connect success, authentication failure, disconnect/unexpected disconnect, reconnect attempt success/fail.
- Streaming: start/stop success, failure to start/stop, warning when streaming is active while recording is off (informational).
- Recording: start/stop/pause/resume success, failure to start/stop, disk-space/permission failure message.
- Scene/transition: scene switch confirmation, transition triggered, transition failure.
- Health: dropped frames > threshold, bitrate < threshold, CPU > threshold (defaults: 2% dropped frames, <2500 kbps bitrate, >85% CPU); only once per 30s unless the state clears.
- Settings: connection details saved/cleared.

## Delivery & UX Rules
- **In-app toasts** (stacked bottom-right): color-coded (success/info/warning/error), auto-dismiss after 4s; errors persist with a close button.
- **System notifications** (Web Notifications API) are opt-in and only fire when the window is unfocused; mirror toast content but with shorter copy.
- Debounce identical events within 1s to avoid spam; coalesce repeat health warnings into a single updated toast.
- Include concise action context in the title (e.g., “Streaming started”, “Connection lost”).
- Keep copy under ~80 characters; prefer verbs and plain language.

## Settings & Controls
- Toggle: “Show in-app notifications” (on by default).
- Toggle: “Allow desktop notifications when unfocused” (off by default; gated behind Notification permission prompt).
- Toggle thresholds for health alerts (dropped frames %, bitrate kbps floor, CPU %).
- Clear all notifications control (in-app only).

## Technical Approach
- Implement a small notification manager in the renderer that:
  - Exposes `showToast(type, message, options)` and `showSystemNotification(type, message)` helpers.
  - Maintains an in-memory list for stacked toasts with auto-dismiss timers.
  - De-duplicates events via a simple key + timestamp map.
- Wire OBS WebSocket events in `app.js` to the manager:
  - Connection/identification handlers → success/error toasts.
  - `StreamStateChanged`, `RecordStateChanged`, `SceneTransitionVideoEnded`, `CurrentProgramSceneChanged`, and health polling → mapped notifications.
- Respect context isolation by relying on contextBridge-exposed helpers and browser Notifications (avoiding direct Node primitives in the renderer); deeper wiring details can live in the technical spec.
- Add permission request flow for system notifications with graceful fallback to in-app toasts.

## Acceptance Criteria
- All triggers above produce a visible in-app toast with accurate state text.
- Duplicate events within 1s do not create multiple toasts.
- System notifications only appear when the window is unfocused **and** the user enabled them.
- Health alerts throttle to at most one toast every 30s per metric until the state clears.
- Copy aligns with dark theme tone; no overflowing text on default window width.

## Rollout Plan
- Phase 1: Implement notification manager + core triggers (connection, streaming, recording) with in-app toasts.
- Phase 2: Add health warnings + debouncing + user settings toggles.
- Phase 3: Optional system notifications with permission gating and unfocused-only guard.
- Phase 4: Polish pass (animation timing, accessibility review, keyboard-focusable close button).
