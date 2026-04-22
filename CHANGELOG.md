# Change Log

## 0.0.1 - April, 22nd 2026

- Initial release of Cypress Tags Explorer
- Automatically parses Cypress test files and extracts tags from `describe`, `context`, and `it` blocks
- Supports tag inheritance across nested blocks
- Resolves Enum tags across multiple files automatically
- Clean, native VS Code Webview displaying all tags alphabetically
- Click-to-Open functionality to jump directly to tests in the editor
- Inline renaming support for tags with smooth `WorkspaceEdit` updates
- Collapsible tag list with rotating indicator using native details/summary HTML tags
