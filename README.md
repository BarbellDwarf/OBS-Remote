# OBS Remote Control

Electron-based desktop application for controlling OBS Studio over WebSocket. Runs on Windows and Linux with a modern dark UI that mirrors core OBS controls.

## What the app does

- **Connection management**: Host/port/password inputs, status indicator, and saved connection profiles.
- **Scenes & sources**: Browse scenes (with optional thumbnails), click to switch, and view sources with visibility indicators.
- **Transitions & studio mode**: Choose transition type and duration, toggle studio mode, and trigger program/preview transitions.
- **Streaming/recording/virtual camera**: Start/stop streaming and recording, pause/resume recording, and control the virtual camera.
- **Audio mixing**: Global and scene audio mixers with volume sliders, mute toggles, and real-time VU meters powered by the `InputVolumeMeters` OBS event.
- **Stats & health**: FPS, CPU, memory, bitrate, dropped frames, bytes sent/received, and stream/record timers.
- **Keyboard shortcuts**: In-app shortcuts for connect, stream, record, studio mode, and transition actions (configurable in settings).

## Requirements

- OBS Studio 28+ with the built-in WebSocket server enabled (default port `4455`)
- Node.js 18+ for development/build steps

## Setup

```bash
git clone https://github.com/BarbellDwarf/OBS-Remote.git
cd OBS-Remote
npm install
```

### Run the app

```bash
npm start      # launch packaged app
npm run dev    # launch with DevTools
```

### Build installers

```bash
npm run build       # build for current platform (outputs to dist/)
npm run build:win   # build Windows targets (run on Windows)
npm run build:linux # build Linux targets (AppImage, .deb, .rpm)
```

## Using OBS Remote

1. Enable the OBS WebSocket server in **Tools → WebSocket Server Settings** and note the port/password.
2. Open OBS Remote, enter host, port, and password, then click **Connect** (status indicator turns green when connected).
3. Switch scenes, adjust sources/transitions, and manage studio mode.
4. Control streaming, recording, and virtual camera from the main controls.
5. Mix audio with live meters.

See [USAGE.md](USAGE.md) for a step-by-step guide and [VISUAL_GUIDE.md](VISUAL_GUIDE.md) for a walkthrough of the layout.

## Known limitations

- OBS WebSocket does **not** stream video frames; preview panels show placeholders. Use the OBS window to view video output.
- Keyboard shortcuts are scoped to the app window (they are not global system hotkeys).
- Recording list management is not available in the app; use OBS to browse recordings.

## Additional documentation

- [DESIGN.md](DESIGN.md) – UI/UX design notes
- [IMPLEMENTATION.md](IMPLEMENTATION.md) – architecture and OBS integration details
- [USAGE.md](USAGE.md) – quick start and usage tips
- [VISUAL_GUIDE.md](VISUAL_GUIDE.md) – annotated UI overview

## License

MIT License – see [LICENSE](LICENSE).
