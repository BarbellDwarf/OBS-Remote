# OBS Remote Control

A modern, cross-platform desktop application for remotely controlling OBS (Open Broadcaster Software) via WebSocket. Built with Electron for Windows and Linux.

![OBS Remote Control](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

### 🎬 Scene Management
- View all available scenes
- Switch between scenes instantly
- Preview sources in selected scene
- Studio Mode support with preview/program views

### 🎚️ Audio Control
- Full audio mixer with all audio sources
- Volume sliders with real-time adjustment and bidirectional sync
- Mute/unmute controls
- **✨ Real-time audio level meters**
  - Uses OBS WebSocket 5.x InputVolumeMeters event
  - Actual audio signal levels from OBS audio engine
  - Updates ~50ms for smooth, responsive VU meters
  - Matches OBS Studio's internal audio meters

### 📺 Studio Mode
- Toggle studio mode on/off
- Scene preview and program organization
- Scene transition controls
- Custom transition selection and duration
- *Note: Video preview not available (WebSocket limitation)*

### 🔴 Stream & Recording Controls
- Start/stop streaming
- Start/stop recording
- Pause/resume recording
- Real-time streaming status

### 📊 Statistics & Monitoring
- Live FPS counter
- CPU usage monitoring
- Memory usage tracking
- Bitrate display
- Dropped frames counter
- Stream duration timer

### 🎭 Scene Transitions
- Select from available transitions
- Adjust transition duration
- Trigger transitions in studio mode

### 💾 Recordings Management
- View recordings list
- Refresh recordings directory

## Prerequisites

- **OBS Studio** (v28.0 or newer) with WebSocket plugin enabled
- **Node.js** (v16 or newer)
- **npm** or **yarn**

## OBS WebSocket Setup

1. Open OBS Studio
2. Go to **Tools** → **WebSocket Server Settings**
3. Check **Enable WebSocket server**
4. Note the **Server Port** (default: 4455)
5. Set a **Password** (optional but recommended)
6. Click **Apply** and **OK**

## Installation

### For Development

```bash
# Clone the repository
git clone https://github.com/BarbellDwarf/OBS-App.git
cd OBS-App

# Install dependencies
npm install

# Run the application
npm start

# Run in development mode (with DevTools)
npm run dev
```

### Build Distributable

```bash
# Build for current platform
npm run build

# Build for Windows
npm run build:win

# Build for Linux
npm run build:linux

# Build for all platforms
npm run build:all
```

Built applications will be in the `dist/` directory.

## Release Automation

- Pushes to `main` trigger a release with semantic version tags (`vMAJOR.MINOR.PATCH`).
- The next version is calculated from the latest tag and the commit messages on the branch.
- Include one of the keywords **#major**, **#minor**, or **#patch** in your commit message to choose the bump level (highest keyword wins).
- If no keyword is present, the release workflow will stop and request one.

## Usage

1. **Launch the Application**
   - Run the installed application or use `npm start` in development

2. **Connect to OBS**
   - Enter the host (e.g., `localhost` or remote IP)
   - Enter the WebSocket port (default: `4455`)
   - Enter the password (if set in OBS)
   - Click **Connect**

3. **Control OBS**
   - **Scenes**: Click on any scene to switch to it
   - **Audio**: Adjust volume sliders, click mute buttons
   - **Studio Mode**: Toggle the switch to enable preview/program mode
   - **Streaming**: Click "Start Streaming" to go live
   - **Recording**: Click "Start Recording" to record
   - **Transitions**: Select transition type and adjust duration

## Interface Overview

### Header Bar
- Connection controls (host, port, password)
- Connection status indicator
- Connect/Disconnect button

### Left Sidebar
- **Scenes List**: All available scenes with active indicator
- **Sources List**: Sources in the selected scene
- **Transitions**: Transition type and duration controls

### Center Panel
- **Studio Mode Toggle**: Switch between single and dual view
- **Preview/Program**: Video output displays
- **Stream/Recording Controls**: Start/stop buttons
- **Statistics**: Real-time OBS performance metrics

### Right Sidebar
- **Audio Mixer**: Volume controls and meters for all audio sources
- **Recordings**: List of recorded files

## Keyboard Shortcuts

- Default bindings (editable in the Hotkeys panel):
  - `Ctrl/Cmd + 1-9`: Switch scenes (scene list order)
  - `Ctrl/Cmd + S`: Start/stop streaming
  - `Ctrl/Cmd + R`: Start/stop recording
  - `Ctrl/Cmd + Shift + S`: Toggle Studio Mode
  - `Ctrl/Cmd + T`: Trigger transition
  - `Ctrl/Cmd + ↑ / ↓`: Volume up/down for the focused audio channel
  - `Ctrl/Cmd + M`: Mute/unmute the focused audio channel
- Hotkeys can be toggled on/off, edited, and restored to defaults from the in-app Hotkeys panel. Focus an audio channel by clicking it before using volume/mute shortcuts.

## Troubleshooting

### Cannot Connect to OBS
- Verify OBS is running
- Check WebSocket is enabled in OBS (Tools → WebSocket Server Settings)
- Ensure correct host and port
- Check firewall settings if connecting remotely
- Verify password is correct

### Audio Levels Not Showing
- Audio level meters now display real-time volume based on OBS input volume
- Meters update 10 times per second for smooth visualization
- If meters aren't updating, check that audio sources are active in OBS

### Preview Not Updating
- **Video Preview Limitation**: OBS WebSocket 5.x does not stream video frames
- Preview panels show placeholder text instead of actual video
- To view video output, use the OBS Studio window itself
- This is a protocol limitation, not an app issue
- Audio levels, scene switching, and all controls still work normally

### Build Errors
- Ensure Node.js version is 16 or newer
- Clear `node_modules` and run `npm install` again
- Check that all dependencies are installed

## Technical Stack

- **Electron**: Cross-platform desktop framework
- **obs-websocket-js**: OBS WebSocket client library
- **HTML/CSS/JavaScript**: Modern web technologies
- **Font Awesome**: Icon library
- **Inter Font**: Clean, modern typography

## Project Structure

```
OBS-App/
├── main.js           # Electron main process
├── preload.js        # Electron preload script
├── index.html        # Main UI layout
├── styles.css        # Application styles
├── app.js            # Application logic and OBS connection
├── package.json      # Project configuration
└── README.md         # Documentation
```

## Platform Support

### Windows
- Windows 10/11 (64-bit)
- Builds: NSIS Installer, Portable EXE

### Linux
- Ubuntu 18.04+ / Debian 10+
- Fedora 32+ / CentOS 8+
- Arch Linux
- Builds: AppImage, .deb, .rpm

## Security Notes

- Passwords are stored with base64 encoding (obfuscation only)
- Connection settings saved in localStorage
- Use strong passwords for remote connections
- Consider using VPN for remote access

## Known Limitations

### Audio Level Metering
**OBS WebSocket API does not provide real-time audio signal levels.** The WebSocket protocol only exposes:
- Volume settings (slider positions)
- Mute status
- Audio track configuration

It does NOT expose:
- Real-time audio signal strength (VU meter data)
- Peak levels
- Audio waveform data

**What this means:** The audio meters in this app show *simulated activity* based on mute status, not actual audio levels. While OBS Studio displays real audio levels internally, this data is not available through the WebSocket API.

**Workaround:** Keep the OBS Studio window visible to monitor actual audio levels.

### Video Preview
**OBS WebSocket API does not stream video frames.** Video preview functionality is not available through the WebSocket protocol.

**Workaround:** Use the OBS Studio window for video preview while using this app for remote control.

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](.github/CONTRIBUTING.md) for details on:
- Development setup and workflow
- Coding standards and conventions
- Testing guidelines
- Pull request process

### For GitHub Copilot Users

This repository includes custom instructions and MCP configurations to enhance your development experience:
- **Copilot Instructions**: See [`.github/copilot-instructions.md`](.github/copilot-instructions.md)
- **MCP Setup**: See [`.github/MCP_SETUP.md`](.github/MCP_SETUP.md) for extending Copilot capabilities

These configurations help Copilot understand our project structure, coding standards, and OBS WebSocket patterns.

## License

MIT License - see LICENSE file for details

## Credits

- Built with [Electron](https://www.electronjs.org/)
- Uses [obs-websocket-js](https://github.com/obs-websocket-community-projects/obs-websocket-js)
- Icons by [Font Awesome](https://fontawesome.com/)

## Support

For issues and questions:
- Open an issue on GitHub
- Check OBS WebSocket documentation
- Review OBS Studio forums

## Roadmap

- [ ] Keyboard shortcuts
- [ ] Custom hotkeys
- [ ] Multi-OBS connection support
- [ ] Recording playback integration
- [ ] Advanced source controls
- [ ] Themes support
- [ ] Multiple language support
- [ ] Video preview (if WebSocket supports it)
- [ ] Scene collection management
- [ ] Profile switching

---

Made with ❤️ for the OBS community
