# Model Context Protocol (MCP) Configuration

This directory contains configuration for extending GitHub Copilot's capabilities through the Model Context Protocol (MCP).

## What is MCP?

Model Context Protocol is an open standard that allows AI agents like GitHub Copilot to interact with external tools, data sources, and services. This enables enhanced capabilities such as:

- Accessing project files and directories
- Managing GitHub issues and pull requests
- Searching npm packages
- Accessing web documentation
- Running custom tools and scripts

## Setup

### For VS Code Users

1. **Copy the example configuration:**
   ```bash
   cp .github/mcp-config.example.json .vscode/mcp.json
   ```

2. **Update environment variables:**
   - Replace `${GITHUB_TOKEN}` with your actual GitHub personal access token
   - Or set the environment variable in your system

3. **Enable MCP in VS Code:**
   - Open VS Code settings
   - Enable `chat.mcp.gallery.enabled`
   - Restart VS Code

4. **Trust the MCP servers:**
   - VS Code will prompt you to trust MCP servers
   - Review and approve trusted servers

### For Copilot CLI Users

1. **Copy to Copilot CLI config location:**
   ```bash
   mkdir -p ~/.copilot
   cp .github/mcp-config.example.json ~/.copilot/mcp-config.json
   ```

2. **Update environment variables** as needed

3. **Use with Copilot CLI:**
   ```bash
   gh copilot --additional-mcp-config ~/.copilot/mcp-config.json
   ```

## Available MCP Servers

### Filesystem Server
- **Purpose**: Access and manipulate project files
- **Use cases**: Reading code, analyzing structure, searching files
- **Command**: `@modelcontextprotocol/server-filesystem`

### GitHub Server
- **Purpose**: Interact with GitHub API
- **Use cases**: Managing issues, PRs, releases, checking CI status
- **Command**: `@modelcontextprotocol/server-github`
- **Requires**: `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable

### NPM Server
- **Purpose**: Search and get information about npm packages
- **Use cases**: Finding dependencies, checking package versions, reading package docs
- **Command**: `@modelcontextprotocol/server-npm`

### Web Search Server
- **Purpose**: Search the web for information
- **Use cases**: Finding OBS WebSocket documentation, Electron examples, troubleshooting
- **Command**: `@modelcontextprotocol/server-web-search`

## Recommended MCP Servers for This Project

### Electron Development
```json
{
  "electron-docs": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-web-search"],
    "description": "Search Electron documentation and examples"
  }
}
```

### OBS WebSocket Development
The web search server is particularly useful for:
- OBS WebSocket API documentation
- obs-websocket-js examples
- Troubleshooting OBS connection issues
- Finding community solutions

### GitHub Integration
Useful for:
- Creating and managing issues
- Reviewing pull requests
- Checking GitHub Actions status
- Managing releases and tags

## Security Considerations

⚠️ **Important Security Notes:**

1. **Only use MCP servers from trusted sources**
   - Review the server code before installation
   - Use official MCP servers from verified publishers
   - Check GitHub repository authenticity

2. **Protect sensitive data**
   - Never commit `mcp.json` or `mcp-config.json` with secrets to version control
   - Use environment variables for tokens and API keys
   - Add `mcp.json` and `mcp-config.json` to `.gitignore`

3. **Review permissions**
   - MCP servers can execute code on your machine
   - Limit server access to necessary directories only
   - Review what each server can access

4. **Environment variables**
   - Store tokens in system environment variables
   - Use `.env` files (add to `.gitignore`)
   - Use secure secret management for production

## Custom MCP Servers

You can create custom MCP servers for project-specific needs:

### Example: OBS Studio Integration
```json
{
  "obs-helper": {
    "command": "node",
    "args": ["./scripts/obs-mcp-server.js"],
    "cwd": "/home/runner/work/OBS-App/OBS-App",
    "description": "Helper tools for OBS WebSocket development"
  }
}
```

### Example: Build and Test Tools
```json
{
  "build-tools": {
    "command": "node",
    "args": ["./scripts/build-mcp-server.js"],
    "description": "Build, test, and package the application"
  }
}
```

## Troubleshooting

### MCP server won't start
1. Check that Node.js is installed and accessible
2. Verify the command path is correct
3. Check environment variables are set
4. Review VS Code developer console for errors

### Permission denied errors
1. Ensure the server has appropriate file system permissions
2. Check the `cwd` path exists and is accessible
3. Verify you've approved the server in VS Code

### Server not appearing in Copilot
1. Restart VS Code after configuration changes
2. Check MCP configuration syntax is valid JSON
3. Enable `chat.mcp.gallery.enabled` in settings
4. Check VS Code output panel for MCP-related errors

## Resources

- [GitHub Copilot MCP Documentation](https://docs.github.com/copilot/customizing-copilot/using-model-context-protocol)
- [VS Code MCP Guide](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [MCP Servers Registry](https://github.com/modelcontextprotocol/servers)
- [Creating Custom MCP Servers](https://modelcontextprotocol.io/docs)

## Contributing

When adding new MCP server configurations:
1. Document the purpose and use cases
2. List required environment variables
3. Add security considerations
4. Update this README with examples
5. Test the configuration before committing

## Getting Help

- Check the [MCP documentation](https://modelcontextprotocol.io)
- Review [GitHub Copilot docs](https://docs.github.com/copilot)
- Ask in project issues with the `copilot` label
- Check VS Code output panel for MCP logs
