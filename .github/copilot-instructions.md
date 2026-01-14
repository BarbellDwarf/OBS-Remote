# GitHub Copilot Instructions for OBS Remote Control

## Project Overview

This is an Electron-based desktop application for remotely controlling OBS Studio via WebSocket. The app provides a modern, cross-platform interface for managing scenes, audio, studio mode, streaming, and recording.

**Tech Stack:**
- Electron (v39.2.7) - Desktop application framework
- obs-websocket-js (v5.0.7) - OBS WebSocket client library
- Vanilla JavaScript/HTML5/CSS3 - No frameworks
- Font Awesome 6.4.0 - Icons
- Inter Font - Typography

**Target Platforms:** Windows 10/11 and Linux (Ubuntu 18.04+, Debian 10+, Fedora 32+, Arch)

## File Structure

```
OBS-App/
├── main.js           # Electron main process (window management)
├── preload.js        # Secure bridge between main and renderer
├── index.html        # Application layout structure
├── styles.css        # Complete styling (~21KB)
├── app.js            # Application logic & OBS WebSocket integration (~51KB)
├── package.json      # Project configuration
├── verify.sh         # Verification script
└── *.md              # Documentation files
```

## Code Style and Conventions

### JavaScript
- Use vanilla JavaScript (ES6+) - no frameworks or external UI libraries
- Use `const` and `let` - never `var`
- Use arrow functions for callbacks and anonymous functions
- Use async/await for asynchronous operations
- Follow semicolon-free style where appropriate
- Use descriptive variable names (e.g., `currentScene`, `audioSources`)
- Organize code logically with clear sections and comments

### HTML
- Use semantic HTML5 elements
- Include ARIA labels for accessibility
- Use data attributes for JavaScript hooks (e.g., `data-scene-id`)
- Keep structure clean and well-indented

### CSS
- Use CSS variables for colors and spacing (already defined in `:root`)
- Follow BEM-like naming for complex components
- Use flexbox and grid for layouts
- Maintain dark theme aesthetic (primary colors: #0084ff, #28a745, #dc3545)
- Use transitions for smooth interactions

### Naming Conventions
- Functions: camelCase (e.g., `connectToOBS()`, `updateSceneList()`)
- Classes: PascalCase (e.g., `OBSWebSocket`)
- Constants: UPPER_SNAKE_CASE for true constants (e.g., `DEFAULT_PORT`)
- DOM element IDs: kebab-case (e.g., `scene-list`, `audio-mixer`)
- CSS classes: kebab-case (e.g., `.scene-item`, `.audio-slider`)

## Build and Development

### Installation
```bash
npm install
```

### Running the App
```bash
npm start          # Production mode
npm run dev        # Development mode (with DevTools)
```

### Building Distributables
```bash
npm run build        # Build for current platform
npm run build:win    # Build for Windows (NSIS + Portable)
npm run build:linux  # Build for Linux (AppImage, deb, rpm)
npm run build:all    # Build for all platforms
```

### Verification
```bash
./verify.sh         # Run project verification script
```

## Security Guidelines

### Connection Security
- WebSocket passwords should be handled securely
- Never commit API keys, tokens, or passwords
- Use `localStorage` carefully - it's not encrypted
- Sanitize all user inputs before displaying

### Electron Security
- Use `contextIsolation: true` in preload (already configured)
- Use `nodeIntegration: false` (already configured)
- Sanitize external content before rendering
- Follow Electron security best practices

### Dependencies
- Keep dependencies up to date
- Review security advisories regularly
- Only add necessary dependencies
- Use `npm audit` to check for vulnerabilities

## OBS WebSocket Integration

### Connection Pattern
```javascript
const obs = new OBSWebSocket();
await obs.connect(`ws://${host}:${port}`, password);
```

### Event Handling
- Subscribe to events: `obs.on('eventName', handler)`
- Unsubscribe when disconnecting
- Handle connection errors gracefully
- Provide user feedback for all states

### Key Events Used
- `SceneListChanged`, `CurrentProgramSceneChanged`
- `StreamStateChanged`, `RecordStateChanged`
- `InputVolumeMeters` (for audio level meters)
- `StudioModeStateChanged`
- `CurrentPreviewSceneChanged`

### API Methods Pattern
```javascript
// Always wrap in try-catch
try {
  const response = await obs.call('RequestName', { params });
  // Handle response
} catch (error) {
  console.error('Error:', error);
  // Show user-friendly error
}
```

## Testing Practices

- Test with actual OBS Studio instance
- Verify WebSocket connection states (connecting, connected, disconnected, error)
- Test all controls (scenes, audio, streaming, recording)
- Check error handling for disconnection scenarios
- Test on both Windows and Linux when possible
- Verify UI responsiveness at different window sizes

## Documentation

### Code Comments
- Add comments for complex logic or OBS-specific behaviors
- Document WebSocket event handlers
- Explain audio level meter calculations
- Note any OBS API limitations or workarounds

### Commit Messages
- Use clear, descriptive commit messages
- Start with action verb (Add, Fix, Update, Remove, Refactor)
- Reference issue numbers when applicable
- Examples:
  - "Add real-time audio level meters using InputVolumeMeters event"
  - "Fix scene switching in studio mode"
  - "Update documentation for audio visualization"

### Markdown Documentation
- Keep README.md up to date with features
- Document known limitations (WebSocket API constraints)
- Provide troubleshooting guidance
- Include setup instructions for OBS WebSocket

## Common Patterns

### Adding New UI Controls
1. Add HTML structure to `index.html`
2. Add styles to `styles.css` (use existing color variables)
3. Add event listeners in `app.js`
4. Handle OBS WebSocket calls
5. Update UI state based on responses

### Handling OBS Events
1. Subscribe to event: `obs.on('EventName', handler)`
2. Update UI state in handler
3. Handle errors gracefully
4. Unsubscribe on disconnect

### Audio Level Metering
- Uses `InputVolumeMeters` event from OBS WebSocket
- Updates ~20 times per second (50ms intervals)
- Values are in dB format (negative values)
- Convert to percentage for visual display

## Known Limitations

### OBS WebSocket API Constraints
- **No video frame streaming**: Video preview is not available through WebSocket
- **Audio levels**: Real-time audio meters now implemented via `InputVolumeMeters` event
- **Source thumbnails**: Not available through API

### Workarounds
- Display placeholder text for video preview
- Use OBS Studio window for actual video monitoring
- Show "Preview not available" messages where appropriate

## Best Practices

### Performance
- Debounce rapid updates (e.g., volume sliders)
- Unsubscribe from events when not needed
- Clean up event listeners on disconnect
- Use requestAnimationFrame for smooth animations

### User Experience
- Provide immediate visual feedback for all actions
- Show loading states during async operations
- Display clear error messages
- Maintain connection status indicator
- Use animations for state transitions

### Error Handling
- Wrap all OBS API calls in try-catch
- Log errors to console for debugging
- Show user-friendly error messages
- Gracefully handle disconnection
- Auto-reconnect option (if implemented)

## Future Enhancements

When adding new features, consider:
- Keyboard shortcuts for common actions
- Custom hotkey configuration
- Multi-OBS connection support
- Scene collection management
- Profile switching
- Themes support
- Internationalization (i18n)

## Resources

- [OBS WebSocket Protocol](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md)
- [obs-websocket-js Documentation](https://github.com/obs-websocket-community-projects/obs-websocket-js)
- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
