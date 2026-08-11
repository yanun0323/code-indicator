# Changelog

## 1.0.6

- Save images pasted into the embedded terminal and insert Markdown image links.
- Add custom image directory settings with automatic fallback to `.tmp/images`.
- Support PNG, JPEG, GIF, WebP, BMP, AVIF, TIFF, and SVG images up to 20 MB.
- Group settings into Terminal, Image Paste, and Context Menu in a fixed order.

## 1.0.5

- Fix embedded terminal layout sizing inside the Code Indicator view.
- Keep terminal padding on the view body so the terminal container can fill the available space without viewport overflow.

## 1.0.4

- Use the VS Code console codicon for the Code Indicator activity bar icon.

## 1.0.3

- Add an embedded terminal startup command setting.
- Add Code Indicator settings access from the terminal view toolbar.
- Keep the Code Indicator view open when killing the embedded terminal.
- Make the view command open-only and restore the Spawn Terminal toolbar button.
- Clear and reset the embedded terminal view on kill and restart.
- Hide the terminal cursor when the embedded terminal is stopped.

## 1.0.2

- Add a terminal trailing character setting with `space` as the default.
- Support the previous newline submit behavior through `codeIndicator.terminal.trailingCharacter`.

## 1.0.0

- Initial release.
- Copy or send editor locations in an `rg`-friendly format.
- Support selected ranges and cursor-only locations.
- Add configurable editor context menu items.
- Focus the active terminal after sending a location by default.
