# Change Log

## 0.2.0 - April, 24th 2026

- **Improved Parsing Robustness**: The AST parser now handles Cypress and BDD test aliases seamlessly, including `scenario` and `feature` blocks.
- **Support for Modifiers**: Test blocks using modifiers like `.only` and `.skip` (e.g. `it.only`, `describe.skip`) are now correctly recognized and parsed.
- **Robust Enum Resolution**: Enum-based tags now resolve flawlessly even when exported from directory index files (`index.ts` / `index.js`) or imported via grouped named imports.
- **Multi-line Template Support**: Fixed an issue where the extension failed to extract test titles if they were defined using multi-line template literals.


## 0.1.0 - April, 23rd 2026

- **Native VS Code Sidebar View**: Added a new Activity Bar icon (`Tags Explorer`) providing a native, hierarchical tree view of your Cypress tags.
- **Hierarchical Tags**: Automatically infers tag hierarchies based on test subset inclusion.
- **Tree vs Flat View Toggle**: Both the Webview and the Sidebar View now feature a toggle to switch seamlessly between a hierarchical "Tree View" and a simple flat list.
- **Advanced Filtering**: Added a powerful filter bar to the Webview to instantly search across Tags, Filenames, and Test titles.
- **Untagged Test Grouping**: Untagged tests (`it` blocks without any tags) are distinctly grouped under a special `[Untagged]` node in the Sidebar and an "UNTAGGED TESTS" tab in the Webview.
- **Quick Access**: Added a handy button in the Sidebar's title menu to quickly launch the full-page Webview.


## 0.0.1 - April, 22nd 2026

- Initial release of Cypress Tags Explorer
- Automatically parses Cypress test files and extracts tags from `describe`, `context`, and `it` blocks
- Supports tag inheritance across nested blocks
- Resolves Enum tags across multiple files automatically
- Clean, native VS Code Webview displaying all tags alphabetically
- Click-to-Open functionality to jump directly to tests in the editor
- Inline renaming support for tags with smooth `WorkspaceEdit` updates
- Collapsible tag list with rotating indicator using native details/summary HTML tags
