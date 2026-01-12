# OBS Remote Control - Quick Start Guide

## Installation & Setup

### Step 1: Install Node.js
Download and install Node.js (v16+) from https://nodejs.org/

### Step 2: Install Dependencies
```bash
cd OBS-App
npm install
```

### Step 3: Configure OBS WebSocket
1. Open OBS Studio
2. Go to **Tools** → **WebSocket Server Settings**
3. Enable the WebSocket server
4. Note the port number (default: 4455)
5. Set a password (optional)

### Step 4: Run the Application
```bash
npm start
```

## First Time Connection

When you first launch the app:

1. **Enter Connection Details**
   - Host: `localhost` (or IP address for remote OBS)
   - Port: `4455` (default OBS WebSocket port)
   - Password: (if you set one in OBS)

2. **Click Connect**
   - Status indicator will turn green when connected
   - All scenes, sources, and audio controls will load automatically

## Main Features

### Scene Control
- **Left Sidebar** shows all available scenes
- Click any scene to switch to it
- Active scene is highlighted with a blue border
- Sources in the selected scene appear below

### Audio Mixer
- **Right Sidebar** shows all audio sources
- Each source has:
  - Volume slider (0-100%)
  - Mute/Unmute button
  - Real-time audio level meter

### Studio Mode
1. Toggle the **Studio Mode** switch at the top
2. When enabled:
   - Left panel shows Preview
   - Right panel shows Program (live)
   - Click scenes to load them in Preview
   - Click **Transition** button to make them live

### Streaming Controls
- **Start Streaming**: Goes live with your stream
- **Stop Streaming**: Ends the stream
- Stream duration and stats shown below

### Recording Controls
- **Start Recording**: Begins recording
- **Stop Recording**: Ends recording
- **Pause/Resume**: Pause and resume recording

### Transitions
- Select transition type from dropdown
- Adjust transition duration (in milliseconds)
- Applies when switching scenes or using studio mode

### Statistics Panel
Real-time monitoring shows:
- **Streaming Time**: Duration of current stream
- **FPS**: Current frames per second
- **CPU Usage**: OBS process CPU usage
- **Memory**: OBS memory consumption
- **Bitrate**: Current streaming bitrate
- **Dropped Frames**: Count and percentage

## Keyboard Shortcuts (Future Feature)

Coming soon:
- `Ctrl/Cmd + 1-9`: Quick scene switching
- `Ctrl/Cmd + S`: Toggle streaming
- `Ctrl/Cmd + R`: Toggle recording

## Troubleshooting

### Cannot Connect
- Verify OBS is running
- Check WebSocket is enabled in OBS settings
- Ensure correct host and port
- Try `localhost` instead of `127.0.0.1`
- Check firewall settings

### No Audio Sources
- Add audio sources in OBS first
- Click Disconnect and Connect again
- Verify sources are not hidden in OBS

### High CPU Usage
- Close DevTools if open
- Reduce number of active sources in OBS
- Check OBS settings for performance issues

### Build Errors
- Update Node.js to latest LTS version
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Ensure you have write permissions

## Building for Distribution

### Linux
```bash
npm run build:linux
```
Outputs: AppImage, .deb, and .rpm in `dist/`

### Windows (on Windows machine)
```bash
npm run build:win
```
Outputs: Installer and portable .exe in `dist/`

### Both Platforms
```bash
npm run build:all
```

## Remote Access

To control OBS from another computer:

1. **On the OBS computer:**
   - Note the IP address (`ipconfig` on Windows, `ifconfig` on Linux)
   - Ensure OBS WebSocket is accessible (check firewall)
   - Port 4455 must be open

2. **On the remote computer:**
   - Enter the OBS computer's IP address
   - Enter port 4455
   - Enter the password
   - Click Connect

## Security Best Practices

- Always use a strong password for remote connections
- Use VPN for remote access outside your network
- Don't expose WebSocket port to the internet without protection
- Keep OBS and the app updated

## Tips & Tricks

1. **Save Connection Settings**: Your host and port are saved automatically
2. **Studio Mode**: Use for professional streams with preview before going live
3. **Monitor Stats**: Keep an eye on dropped frames and CPU usage
4. **Audio Levels**: Adjust audio in the app or in OBS - both work!
5. **Multiple Scenes**: Prepare multiple scenes before streaming

## Advanced Usage

### Multiple OBS Instances
- Currently supports one connection at a time
- To switch between OBS instances, disconnect and reconnect with new details

### Scene Collections
- Scene collections are managed in OBS
- The app displays the currently active collection

### Custom Transitions
- All transitions configured in OBS appear in the dropdown
- Stinger transitions and custom transitions are supported

## Getting Help

- Check the main README.md for detailed documentation
- Review OBS WebSocket documentation for protocol details
- Open an issue on GitHub for bugs or feature requests

## System Requirements

**Minimum:**
- OS: Windows 10 / Ubuntu 18.04 or newer
- RAM: 2GB
- CPU: Dual-core processor
- OBS Studio 28.0 or newer

**Recommended:**
- OS: Windows 11 / Ubuntu 22.04
- RAM: 4GB+
- CPU: Quad-core processor
- OBS Studio 30.0 or newer
- Stable network connection for remote access

---

**Need more help?** Check the full documentation in README.md
