(function () {
  const vscode = acquireVsCodeApi();
  const terminalContainer = document.getElementById("terminal");
  const statusPanel = document.getElementById("statusPanel");
  const statusText = document.getElementById("statusText");
  const restartButton = document.getElementById("restartButton");
  const styles = getComputedStyle(document.documentElement);
  const terminal = new Terminal({
    allowTransparency: true,
    cursorBlink: true,
    convertEol: true,
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

  terminal.loadAddon(fitAddon);
  terminal.open(terminalContainer);
  terminal.onData((data) => {
    vscode.postMessage({ type: "input", data });
  });

  restartButton.addEventListener("click", () => {
    terminal.clear();
    setStatus("終端機啟動中", false);
    vscode.postMessage({ type: "restart" });
    terminal.focus();
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || typeof message.type !== "string") {
      return;
    }

    switch (message.type) {
      case "data":
        if (typeof message.data === "string" && message.data.length > 0) {
          terminal.write(message.data);
        }
        break;
      case "status":
        setStatus(message.message, message.state === "exited" || message.state === "error");
        break;
      case "exit":
        setStatus("終端機已結束", true);
        break;
    }
  });

  const resizeObserver = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(fitAndNotify, 25);
  });
  resizeObserver.observe(terminalContainer);

  requestAnimationFrame(() => {
    fitAndNotify();
    terminal.focus();
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

  function setStatus(message, showRestart) {
    statusText.textContent = message || "";
    restartButton.hidden = !showRestart;
    statusPanel.classList.toggle("visible", Boolean(message) && showRestart);
  }
})();
