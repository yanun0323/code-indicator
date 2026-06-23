# Changelog

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
