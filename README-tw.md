# Code Indicator

[![English](https://img.shields.io/badge/English-Click-yellow)](README.md)
[![繁體中文](https://img.shields.io/badge/繁體中文-點擊查看-orange)](README-tw.md)
[![简体中文](https://img.shields.io/badge/简体中文-点击查看-orange)](README-cn.md)

Code Indicator 是專為 Codex、Claude Code、OpenCode 這類 CLI coding agent 設計的 VS Code extension。

它可以複製或傳送目前編輯器中的程式碼位置，格式相容 `rg`，讓你能快速把精準的檔案、行、欄位或選取範圍交給 agent 檢查或修改。

<a href="."><img height="320" src="./example.gif"></a>

## 為什麼需要

CLI coding agent 收到精準的 code location 時，工作效果最好。你不用手動輸入路徑和行號，只要選取程式碼、按右鍵，就能直接把位置送到 terminal。

沒有選取文字時，Code Indicator 會使用游標位置。

## Commands

- `codeIndicator.copySelectionLocation`
- `codeIndicator.sendSelectionLocationToActiveTerminal`
- `codeIndicator.copySelectionLocationAndSendToActiveTerminal`
- `codeIndicator.toggleView`
- `codeIndicator.spawnTerminal`
- `codeIndicator.killTerminal`
- `codeIndicator.restartTerminal`
- `codeIndicator.openSettings`

每個 command 都可以從 Command Palette、editor context menu，以及 VS Code Keyboard Shortcuts 使用。

## Embedded Terminal

Code Indicator 內建 activity bar view 與 embedded terminal。傳送位置時，如果 embedded terminal 可用，會自動啟動並 focus，然後依照設定的 trailing character 寫入位置。

view toolbar 可以 spawn、kill、restart Code Indicator terminal，或開啟 settings。kill terminal 後 view 會保持開啟，並清除已停止 session 的輸出。

## 圖片貼上

將圖片貼到 embedded terminal。Code Indicator 會將圖片儲存在第一個 workspace folder 下的 `.tmp/images`。如果目錄不存在，Code Indicator 會建立目錄。檔案名稱使用目前的 Unix 毫秒時間戳。

圖片儲存成功後，Code Indicator 會插入 Markdown 圖片連結。Code Indicator 不會在連結前加入空白。`codeIndicator.terminal.trailingCharacter` 會控制連結後綴。預設的 `space` 設定會產生下列文字：

```text
[image](./.tmp/images/1786423812345.png)<space>
```

如果設定為 `newline`，Code Indicator 會在插入連結後送出 terminal input。

Code Indicator 支援 PNG、JPEG、GIF、WebP、BMP、AVIF、TIFF 和 SVG 圖片。圖片大小上限為 20 MB。

## Settings

設定分為 Terminal、Image Paste 和 Context Menu 三個分類。terminal startup command 是選填。Code Indicator terminal 會在 spawn、reload，或開啟 view 自動啟動時執行此 command。傳送到 terminal 後自動 focus terminal 的功能預設開啟。Code location 或 Markdown 圖片連結的後綴預設是空白。editor context menu 的項目可以個別顯示或隱藏。

若要使用其他圖片目錄，請啟用 `codeIndicator.useCustomImageDirectory`，並設定 `codeIndicator.customImageDirectory`。你可以使用絕對路徑，或第一個 workspace folder 的相對路徑。如果設定值是空值或目錄無法使用，Code Indicator 會使用第一個 workspace folder 下的 `.tmp/images`。

圖片位於第一個 workspace folder 內時，圖片連結會使用相對路徑。圖片位於第一個 workspace folder 外時，圖片連結會使用絕對路徑。

```json
{
  "codeIndicator.terminal.startupCommand": "",
  "codeIndicator.terminal.focusAfterSend": true,
  "codeIndicator.terminal.trailingCharacter": "space",
  "codeIndicator.useCustomImageDirectory": false,
  "codeIndicator.customImageDirectory": "",
  "codeIndicator.contextMenu.copyLocation": true,
  "codeIndicator.contextMenu.sendLocationToTerminal": true,
  "codeIndicator.contextMenu.copyAndSendLocationToTerminal": true
}
```

`codeIndicator.terminal.trailingCharacter` 可設為 `space` 或 `newline`。此設定會套用到傳送的 code location 和貼上的 Markdown 圖片連結。

## Output Format

```text
relative/path.ext:startLine:startColumn-endLine:endColumn
```

位置是 1-based。結束位置使用 VS Code 的 exclusive selection end。

範例：

```text
src/extension.ts:10:3-12:18
src/extension.ts:10:3-10:3
```

路徑會相對於所在的 workspace folder。workspace 外的檔案會使用絕對路徑。

## 授權

MIT
