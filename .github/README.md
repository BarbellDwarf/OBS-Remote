# .github Directory

This directory contains GitHub-specific configuration files and documentation for the OBS Remote Control project.

## Files Overview

### `copilot-instructions.md`
**Purpose**: Provides GitHub Copilot with repository-specific coding guidelines, conventions, and best practices.

**What it contains:**
- Project overview and tech stack
- Code style and naming conventions
- Build, test, and development commands
- Security guidelines
- OBS WebSocket integration patterns
- Testing practices
- Documentation standards
- Known limitations and workarounds

**Who should read it:**
- Developers using GitHub Copilot
- New contributors learning project conventions
- Anyone wanting to understand coding standards

**Learn more**: [GitHub Copilot Custom Instructions](https://docs.github.com/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)

### `mcp-config.example.json`
**Purpose**: Example configuration for Model Context Protocol (MCP) servers to extend GitHub Copilot's capabilities.

**What it contains:**
- Filesystem access configuration
- GitHub API integration
- NPM package search
- Web search for documentation

**How to use:**
1. Copy to `.vscode/mcp.json` (VS Code) or `~/.copilot/mcp-config.json` (CLI)
2. Update environment variables (e.g., GITHUB_TOKEN)
3. Enable MCP in your IDE
4. See `MCP_SETUP.md` for detailed instructions

**⚠️ Security Note**: Never commit the actual `mcp.json` or `mcp-config.json` with secrets to version control. These files are in `.gitignore`.

### `MCP_SETUP.md`
**Purpose**: Comprehensive guide for setting up and using Model Context Protocol with this project.

**What it contains:**
- MCP overview and benefits
- Step-by-step setup instructions
- Available MCP servers documentation
- Security considerations
- Troubleshooting guide
- Custom MCP server examples

**Who should read it:**
- Developers wanting to enhance Copilot capabilities
- Contributors using advanced AI-assisted development
- Anyone interested in extending IDE functionality

### `CONTRIBUTING.md`
**Purpose**: Guidelines for contributing to the OBS Remote Control project.

**What it contains:**
- Getting started guide
- Development setup instructions
- Contribution workflow
- Coding standards
- Testing guidelines
- Pull request process
- GitHub Copilot integration tips

**Who should read it:**
- First-time contributors
- Anyone planning to submit pull requests
- Developers wanting to understand project standards

### `instructions/` (directory)
**Purpose**: Path-specific custom instructions for GitHub Copilot (future use).

**Potential uses:**
- Frontend-specific guidelines
- Backend-specific patterns
- Component-specific rules
- Module-specific conventions

**Example structure:**
```
instructions/
├── frontend.instructions.md
├── backend.instructions.md
└── testing.instructions.md
```

## Quick Reference

### For New Contributors
1. Read `CONTRIBUTING.md` first
2. Review `copilot-instructions.md` for coding standards
3. Set up development environment per README.md
4. (Optional) Configure MCP using `MCP_SETUP.md`

### For GitHub Copilot Users
1. GitHub Copilot automatically reads `copilot-instructions.md`
2. For enhanced capabilities, set up MCP using `mcp-config.example.json` and `MCP_SETUP.md`
3. Review `CONTRIBUTING.md` for Copilot best practices

### For Maintainers
- Keep `copilot-instructions.md` updated with new conventions
- Review and update `CONTRIBUTING.md` as project evolves
- Add path-specific instructions in `instructions/` as needed
- Document new MCP servers in `MCP_SETUP.md`

## File Relationships

```
┌─────────────────────────────────────────────────────────┐
│ CONTRIBUTING.md                                          │
│ (Main contributor guide - references all other files)   │
└────────┬────────────────────────────────────────────────┘
         │
    ├────┴────┬────────────┬──────────────┐
    │         │            │              │
    ▼         ▼            ▼              ▼
┌────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐
│copilot-│ │  MCP    │ │   mcp   │ │instructions/ │
│instruc │ │ SETUP   │ │ config  │ │  (future)    │
│tions.md│ │  .md    │ │example  │ │              │
└────────┘ └─────────┘ └─────────┘ └──────────────┘
(Coding    (MCP setup  (MCP config  (Path-specific
 standards) guide)      example)     instructions)
```

## Maintenance

### When to Update These Files

**`copilot-instructions.md`:**
- Adding new coding conventions
- Changing project structure
- Adding/removing dependencies
- Documenting new patterns or best practices
- Updating build/test commands

**`mcp-config.example.json`:**
- Adding new useful MCP servers
- Updating MCP server configurations
- Changing environment variable requirements

**`MCP_SETUP.md`:**
- New MCP servers added to configuration
- Security best practices change
- Troubleshooting new issues
- Adding custom MCP server examples

**`CONTRIBUTING.md`:**
- Process changes (PR workflow, review process)
- New tools or requirements
- Updating testing guidelines
- Adding new contribution types

### Review Schedule

- **Quarterly**: Review all files for accuracy
- **Before major releases**: Update with any new conventions
- **When onboarding**: Get feedback from new contributors
- **After incidents**: Document lessons learned

## Additional Resources

- [GitHub Copilot Documentation](https://docs.github.com/copilot)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Contributing to Open Source](https://opensource.guide/how-to-contribute/)
- [OBS WebSocket Protocol](https://github.com/obsproject/obs-websocket)

## Questions?

If you have questions about these files or their usage:
1. Check the file itself for detailed information
2. Review related documentation in the main README.md
3. Create an issue with your question
4. Reach out to maintainers

---

**Note**: This is a living directory. As the project evolves, these files should be kept up to date to ensure the best contributor and Copilot experience.
