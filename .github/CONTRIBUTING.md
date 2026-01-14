# Contributing to OBS Remote Control

Thank you for your interest in contributing to OBS Remote Control! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [GitHub Copilot Integration](#github-copilot-integration)

## Code of Conduct

We expect all contributors to be respectful and constructive. Please:
- Be welcoming and inclusive
- Respect differing viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what's best for the community and project

## Getting Started

### Prerequisites

- **Node.js** v16 or newer
- **npm** or **yarn**
- **OBS Studio** v28.0 or newer (for testing)
- **Git** for version control
- Basic understanding of Electron and WebSocket

### First-Time Setup

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/OBS-App.git
   cd OBS-App
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/BarbellDwarf/OBS-App.git
   ```

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Run the application:**
   ```bash
   npm start
   ```

## Development Setup

### Running in Development Mode

```bash
npm run dev
```

This opens the app with DevTools enabled for debugging.

### OBS WebSocket Configuration

1. Open OBS Studio
2. Go to **Tools** → **WebSocket Server Settings**
3. Enable WebSocket server
4. Note the port (default: 4455) and set a password
5. Use these credentials to connect from the app

### Project Structure

```
OBS-App/
├── .github/                    # GitHub configurations
│   ├── copilot-instructions.md # Copilot coding guidelines
│   ├── mcp-config.example.json # MCP configuration example
│   └── MCP_SETUP.md           # MCP setup documentation
├── main.js                    # Electron main process
├── preload.js                 # Electron preload script
├── index.html                 # Main UI layout
├── styles.css                 # Application styles
├── app.js                     # Application logic
├── package.json               # Project configuration
└── *.md                       # Documentation
```

## How to Contribute

### Reporting Bugs

1. **Check existing issues** to avoid duplicates
2. **Create a new issue** with:
   - Clear, descriptive title
   - Steps to reproduce the bug
   - Expected vs. actual behavior
   - Screenshots (if applicable)
   - Environment details (OS, OBS version, app version)
   - Error messages or logs

### Suggesting Features

1. **Check existing feature requests**
2. **Create a new issue** with:
   - Clear description of the feature
   - Use cases and benefits
   - Possible implementation approach
   - Alternative solutions considered

### Improving Documentation

Documentation improvements are always welcome:
- Fix typos or unclear instructions
- Add examples or screenshots
- Update outdated information
- Translate documentation (future)

### Contributing Code

1. **Find or create an issue** to work on
2. **Comment on the issue** to claim it
3. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes** (see Coding Standards below)
5. **Test thoroughly** (see Testing Guidelines)
6. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Add feature: brief description"
   ```
7. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Create a Pull Request** on GitHub

## Coding Standards

### JavaScript Style

- **ES6+ features**: Use modern JavaScript (const, let, arrow functions, async/await)
- **No frameworks**: Keep it vanilla JavaScript
- **Semicolons**: Follow the existing style (semicolon-free where appropriate)
- **Naming**:
  - Functions: `camelCase` (e.g., `updateSceneList()`)
  - Variables: `camelCase` (e.g., `currentScene`)
  - Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_PORT`)
- **Comments**: Add comments for complex logic, especially OBS API quirks

### HTML Style

- Use semantic HTML5 elements
- Include ARIA labels for accessibility
- Use data attributes for JavaScript hooks
- Keep structure clean and indented

### CSS Style

- Use existing CSS variables (defined in `:root`)
- Follow existing naming conventions (kebab-case)
- Maintain dark theme consistency
- Add comments for complex selectors
- Use flexbox/grid for layouts

### Code Organization

- Group related functions together
- Add section comments to organize code
- Keep functions focused and single-purpose
- Extract repeated code into reusable functions

## Testing Guidelines

### Manual Testing Checklist

Before submitting a PR, test:

- [ ] **Connection**: Connect/disconnect from OBS
- [ ] **Scenes**: Switch between scenes
- [ ] **Audio**: Adjust volume, mute/unmute
- [ ] **Studio Mode**: Toggle on/off, transitions
- [ ] **Streaming**: Start/stop streaming
- [ ] **Recording**: Start/stop/pause recording
- [ ] **Statistics**: Verify real-time updates
- [ ] **UI Responsiveness**: Test different window sizes
- [ ] **Error Handling**: Test with OBS disconnected

### Platform Testing

- Test on **Windows** (if possible)
- Test on **Linux** (if possible)
- Note any platform-specific issues

### OBS WebSocket Testing

- Test with **OBS 28.0+**
- Test with different OBS configurations
- Test connection errors (wrong password, wrong port, etc.)

## Pull Request Process

### Before Submitting

1. **Update documentation** if you added/changed features
2. **Test your changes** thoroughly
3. **Check code style** matches existing conventions
4. **Rebase on latest main** if needed:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Related Issue
Fixes #123 (or Related to #123)

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactoring
- [ ] Performance improvement

## Changes Made
- Bullet point list of changes

## Testing Done
- Describe how you tested the changes
- List any edge cases tested

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tested thoroughly
- [ ] No new warnings or errors
```

### Review Process

1. **Automated checks**: Ensure builds pass (when CI is set up)
2. **Code review**: Maintainers will review your code
3. **Address feedback**: Make requested changes
4. **Approval**: Once approved, maintainers will merge

## GitHub Copilot Integration

### Using Copilot for Contributions

This project has GitHub Copilot instructions configured to help with development:

- **Instructions file**: `.github/copilot-instructions.md`
- **MCP configuration**: `.github/mcp-config.example.json`

### Copilot Best Practices for This Project

1. **Read project conventions**: Check `.github/copilot-instructions.md`
2. **Follow OBS WebSocket patterns**: Use established patterns for API calls
3. **Maintain code style**: Let Copilot suggest code that matches existing style
4. **Review suggestions**: Always review and test Copilot's suggestions
5. **Document complex code**: Add comments for non-obvious logic

### MCP Setup (Optional)

To extend Copilot capabilities:
1. Review `.github/MCP_SETUP.md`
2. Copy `.github/mcp-config.example.json` to appropriate location
3. Configure environment variables
4. Enable in VS Code settings

## Commit Message Guidelines

### Format

```
<type>: <subject>

<body> (optional)

<footer> (optional)
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic change)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```
feat: Add keyboard shortcuts for scene switching

- Add Ctrl+1-9 for switching to scenes 1-9
- Add Ctrl+S for toggling streaming
- Update documentation with shortcuts

Fixes #42
```

```
fix: Correct audio level meter calculation

Audio meters were showing incorrect values due to dB to
percentage conversion error. Now using correct formula.
```

## Questions or Need Help?

- **Ask in issues**: Create an issue with your question
- **Check documentation**: Review README.md and other docs
- **Review existing code**: Look at similar implementations
- **OBS WebSocket docs**: Consult the official protocol documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to OBS Remote Control! 🎉
