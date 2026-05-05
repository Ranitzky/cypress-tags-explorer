# Cypress Tags Explorer

A powerful VS Code extension to easily manage, view, and organize Cypress tags right within your editor.

![Cypress Tags Explorer Screenshot](images/screenshot.png)

## Features

- **Native Sidebar View & Webview**: Manage tags using a lightweight native VS Code Sidebar tree, or pop open the rich, full-page Webview interface.
- **Hierarchical Tags**: The explorer automatically infers tag relationships (if all tests for `@smoke` also have `@e2e`, `@smoke` is seamlessly nested under `@e2e`).
- **Tree vs Flat List**: Effortlessly toggle between nested tag hierarchies and flat alphabetical lists in both the Sidebar and the Webview.
- **Advanced Filtering**: Quickly find specific tests using the filter bar in the Webview or the filter icon in the Sidebar title menu. Search by Tags, Filenames, or test titles (`describe` > `context` > `it`). Tag filtering supports a full boolean expression language with `AND`, `OR`, `NOT` keywords and parentheses for grouping.
- **AST Parsing**: Automatically parses your Cypress files (`describe`, `context`, `it` blocks) to extract tags without executing any code.
- **Tag Inheritance**: Accurately reflects Cypress tag inheritance. Tags applied to a `describe` block automatically cascade down to its `it` blocks.
- **Enum Resolution**: Supports both plain string tags (e.g., `'@smoke'`) and Enums (e.g., `Priority.HIGH`). It intelligently traces imports across your workspace to resolve the underlying string values of enums.
- **Organized Overview**: Displays all discovered tags sorted alphabetically or hierarchically, along with test counts. Tests without tags are clearly grouped under `[Untagged]`.
- **Click-to-Open**: Click on any test in the tree or list to instantly jump to the corresponding line in your editor, making it effortless to add or reassign tags.
- **Inline Renaming**: Rename tags across your entire workspace directly from the UI. The extension safely updates your code using native VS Code `WorkspaceEdit` features, preserving your formatting.

## Usage

1. **Sidebar View**: Click the **Tag Icon** in the VS Code Activity Bar (left sidebar) to view your parsed tags natively.
2. **Webview**: Click the "Open Webview" icon in the Sidebar's title menu, or search for and execute the **"Cypress Tags Explorer: Open Webview"** command from the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).

## Tag Filter Syntax

The powerful boolean expression language is supported when searching by **Tags** in both the Webview filter bar and the Sidebar native filter input. Filename and test-title filters always use a simple substring match.

### Operators

| Operator | Keyword | Legacy shorthand | Meaning |
|---|---|---|---|
| AND | `AND` | `+` between tags | Both tags must be present |
| OR | `OR` | space between tags | Either tag must be present |
| NOT | `NOT` | `-` prefix on a tag | Tag must **not** be present |
| Group | `(` `)` | — | Evaluate sub-expression first |

> **Operator precedence** (high → low): `NOT` → `AND` → `OR`

### Examples

```
# Single tag
@smoke

# OR  – either tag (keyword)
@smoke OR @critical

# OR  – either tag (legacy: space-separated)
@smoke @critical

# AND – both tags required (keyword)
@smoke AND @critical

# AND – both tags required (legacy: + separated)
@smoke+@critical

# NOT – exclude a tag (keyword)
NOT @slow

# NOT – exclude a tag (legacy: - prefix)
-@slow

# AND + NOT – tagged smoke but not slow (keyword)
@smoke AND NOT @slow

# AND + NOT – tagged smoke but not slow (legacy)
@smoke+-@slow

# Complex grouped expression
(@smoke OR @critical) AND NOT @slow

# Multiple OR-groups, one of which is an AND
@regression (@smoke AND @critical)
```

> Matching is **case-insensitive** and uses **substring** comparison, so `smoke` matches `@smoke`.

## Setup & Configuration

By default, the extension scans the `cypress/e2e` folder for `*.cy.ts` and `*.cy.js` files. 
You can customize this behavior in your VS Code `settings.json`:

```json
{
  "tagsExplorer.cypressFolder": "cypress/e2e",
  "tagsExplorer.fileExtensions": "*.cy.ts,*.cy.js"
}
```

## How to Run locally

1. Clone this repository and open the folder in VS Code.
2. Run `npm install` to install dependencies.
3. Press `F5` to open a new window with the extension loaded (Extension Development Host).
4. Click the Tag icon in the left Activity Bar to open the Sidebar view, or open the Command Palette and run **"Cypress Tags Explorer: Open Webview"**.
