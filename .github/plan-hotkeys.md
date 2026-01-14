# Plan: Hotkey Support
- **Goal**: Keyboard controls for scenes (1-9), stream/record/studio toggles, transitions, volume, mute.
- **Dependencies**: Settings shortcut map; focus management to avoid conflicts with form fields; existing OBS IPC calls.
- **Steps**:
  1. Implement global key listener with enable/disable toggle from settings; respect modal/focus guard and prevent key-repeat spam.
  2. Map keys to actions: scene switch (cache scene list), Start/StopStream, Start/StopRecording, ToggleStudioMode, TriggerTransition, volume up/down for focused source, mute/unmute focused source.
  3. Surface visual hints/tooltips for active bindings; detect conflicts; allow restore defaults.
  4. Persist bindings via settings; provide UI to edit per action and save.

