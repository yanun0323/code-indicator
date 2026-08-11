(function () {
  const vscode = acquireVsCodeApi();
  const terminalContainer = document.getElementById("terminal");
  const statusPanel = document.getElementById("statusPanel");
  const statusText = document.getElementById("statusText");
  const restartButton = document.getElementById("restartButton");
  const maxPastedImageBytes = Number(terminalContainer.dataset.maxPastedImageBytes);
  const styles = getComputedStyle(document.documentElement);
  const terminal = new Terminal({
    allowTransparency: true,
    cursorBlink: true,
    cursorInactiveStyle: "none",
    convertEol: true,
    disableStdin: false,
    fontFamily: styles.getPropertyValue("--vscode-editor-font-family") || "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: Number.parseInt(styles.getPropertyValue("--vscode-editor-font-size"), 10) || 13,
    theme: {
      background: "rgba(0, 0, 0, 0)",
      foreground: styles.getPropertyValue("--vscode-terminal-foreground") || "#cccccc"
    }
  });
  const fitAddon = new FitAddon.FitAddon();
  let lastCols = 0;
  let lastRows = 0;
  let resizeTimer = 0;
  let terminalLive = true;

  terminal.loadAddon(fitAddon);
  terminal.open(terminalContainer);
  terminal.element.addEventListener("paste", handleImagePaste, true);
  terminal.onData((data) => {
    vscode.postMessage({ type: "input", data });
  });

  restartButton.addEventListener("click", () => {
    syncTerminalState("starting");
    resetTerminal();
    setStatus("Terminal is starting", false, false);
    vscode.postMessage({ type: "restart" });
    focusTerminal();
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || typeof message.type !== "string") {
      return;
    }

    switch (message.type) {
      case "clear":
        resetTerminal();
        break;
      case "focus":
        focusTerminal();
        break;
      case "data":
        if (typeof message.data === "string" && message.data.length > 0) {
          terminal.write(message.data);
        }
        break;
      case "status":
        setStatus(
          message.message,
          message.state === "exited" || message.state === "error" || message.state === "stopped",
          message.state === "exited" || message.state === "error"
        );
        syncTerminalState(message.state);
        break;
      case "exit":
        setStatus("Terminal exited", true, true);
        syncTerminalState("exited");
        break;
    }
  });

  window.addEventListener("focus", () => {
    focusTerminal();
  });

  window.addEventListener("blur", () => {
    postFocusState(false);
  });

  const resizeObserver = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(fitAndNotify, 25);
  });
  resizeObserver.observe(terminalContainer);

  requestAnimationFrame(() => {
    fitAndNotify();
    focusTerminal();
    vscode.postMessage({ type: "ready" });
  });

  function fitAndNotify() {
    try {
      fitAddon.fit();
    } catch {
      return;
    }

    if (terminal.cols === lastCols && terminal.rows === lastRows) {
      return;
    }

    lastCols = terminal.cols;
    lastRows = terminal.rows;
    vscode.postMessage({
      type: "resize",
      cols: terminal.cols,
      rows: terminal.rows
    });
  }

  function setStatus(message, showPanel, showRestart) {
    statusText.textContent = message || "";
    restartButton.hidden = !showRestart;
    statusPanel.classList.toggle("visible", Boolean(message) && showPanel);
  }

  function resetTerminal() {
    terminal.reset();
    fitAndNotify();
  }

  function syncTerminalState(state) {
    terminalLive = state === "starting" || state === "ready";
    terminal.options.cursorBlink = terminalLive;
    terminal.options.cursorInactiveStyle = terminalLive ? "outline" : "none";
    terminal.options.disableStdin = !terminalLive;
    terminalContainer.classList.toggle("terminal-inactive", !terminalLive);
    if (!terminalLive) {
      terminal.blur();
    }
  }

  function focusTerminal() {
    if (terminalLive) {
      terminal.focus();
      postFocusState(true);
      return;
    }

    terminal.blur();
    postFocusState(false);
  }

  function postFocusState(focused) {
    vscode.postMessage({
      type: "focusChanged",
      focused
    });
  }

  function handleImagePaste(event) {
    const pastedImage = getPastedImage(event);
    if (!pastedImage) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (pastedImage.file.size > maxPastedImageBytes) {
      vscode.postMessage({ type: "pasteImageTooLarge" });
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        postImageReadError();
        return;
      }

      const separatorIndex = reader.result.indexOf(",");
      if (separatorIndex < 0) {
        postImageReadError();
        return;
      }

      vscode.postMessage({
        type: "pasteImage",
        mediaType: pastedImage.mediaType,
        base64: reader.result.slice(separatorIndex + 1)
      });
    });
    reader.addEventListener("error", postImageReadError);
    reader.readAsDataURL(pastedImage.file);
  }

  function getPastedImage(event) {
    const items = event.clipboardData?.items;
    if (!items) {
      return undefined;
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (item.kind !== "file" || !item.type.startsWith("image/")) {
        continue;
      }

      const file = item.getAsFile();
      if (file) {
        return { file, mediaType: item.type };
      }
    }

    return undefined;
  }

  function postImageReadError() {
    vscode.postMessage({ type: "pasteImageReadError" });
  }
})();
