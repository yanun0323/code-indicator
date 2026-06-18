# Code Indicator

[![English](https://img.shields.io/badge/English-Click-yellow)](README.md)
[![繁體中文](https://img.shields.io/badge/繁體中文-點擊查看-orange)](README-tw.md)
[![简体中文](https://img.shields.io/badge/简体中文-点击查看-orange)](README-cn.md)

Code Indicator 是专为 Codex、Claude Code、OpenCode 这类 CLI coding agent 设计的 VS Code extension。

它可以复制或发送当前编辑器中的代码位置，格式兼容 `rg`，让你能快速把精确的文件、行、列或选中范围交给 agent 检查或修改。

<a href="."><img height="320" src="./example.gif"></a>

## 为什么需要

CLI coding agent 收到精确的 code location 时，工作效果最好。你不用手动输入路径和行号，只要选中代码、右键点击，就能直接把位置发送到 terminal。

没有选中文字时，Code Indicator 会使用光标位置。

## Commands

- `codeIndicator.copySelectionLocation`
- `codeIndicator.sendSelectionLocationToActiveTerminal`
- `codeIndicator.copySelectionLocationAndSendToActiveTerminal`

每个 command 都可以从 Command Palette、editor context menu，以及 VS Code Keyboard Shortcuts 使用。

## Settings

editor context menu 的项目可以单独显示或隐藏。发送到 terminal 后自动 focus terminal 的功能默认开启。发送到 terminal 的最后一个字符默认是空格。

```json
{
  "codeIndicator.contextMenu.copyLocation": true,
  "codeIndicator.contextMenu.sendLocationToTerminal": true,
  "codeIndicator.contextMenu.copyAndSendLocationToTerminal": true,
  "codeIndicator.terminal.focusAfterSend": true,
  "codeIndicator.terminal.trailingCharacter": "space"
}
```

## Output Format

```text
relative/path.ext:startLine:startColumn-endLine:endColumn
```

位置是 1-based。结束位置使用 VS Code 的 exclusive selection end。

示例：

```text
src/extension.ts:10:3-12:18
src/extension.ts:10:3-10:3
```

路径会相对于所在的 workspace folder。workspace 外的文件会使用绝对路径。

## 许可证

MIT
