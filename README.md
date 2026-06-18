# Code Indicator

[![English](https://img.shields.io/badge/English-Click-yellow)](README.md)
[![繁體中文](https://img.shields.io/badge/繁體中文-點擊查看-orange)](README-tw.md)
[![简体中文](https://img.shields.io/badge/简体中文-点击查看-orange)](README-cn.md)

Code Indicator is a VS Code extension built for CLI coding agents such as Codex, Claude Code, and OpenCode.

It copies or sends the current editor location in an `rg`-friendly format, so you can quickly point an agent at the exact file, line, column, or selected range you want it to inspect or change.

<a href="."><img height="320" src="./example.gif"></a>

## Why

CLI coding agents work best when they receive precise code locations. Instead of manually typing paths and line numbers, Code Indicator lets you select code, right-click, and send the location directly to your terminal.

When no text is selected, Code Indicator uses the cursor position.

## Commands

- `codeIndicator.copySelectionLocation`
- `codeIndicator.sendSelectionLocationToActiveTerminal`
- `codeIndicator.copySelectionLocationAndSendToActiveTerminal`

Each command is available from the Command Palette, editor context menu, and VS Code Keyboard Shortcuts.

## Settings

The editor context menu items can be shown or hidden individually. Terminal focus after sending is enabled by default.

```json
{
  "codeIndicator.contextMenu.copyLocation": true,
  "codeIndicator.contextMenu.sendLocationToTerminal": true,
  "codeIndicator.contextMenu.copyAndSendLocationToTerminal": true,
  "codeIndicator.terminal.focusAfterSend": true
}
```

## Output Format

```text
relative/path.ext:startLine:startColumn-endLine:endColumn
```

Positions are 1-based. The end position uses VS Code's exclusive selection end.

Examples:

```text
src/extension.ts:10:3-12:18
src/extension.ts:10:3-10:3
```

Paths are relative to the containing workspace folder. Files outside the workspace use absolute paths.

## License

MIT
