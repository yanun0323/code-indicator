import * as vscode from "vscode";

import { PtyTerminalSession, TerminalSessionStatus } from "./ptyTerminalSession";

const TERMINAL_READY_TYPE = "ready";
const TERMINAL_INPUT_TYPE = "input";
const TERMINAL_RESIZE_TYPE = "resize";
const TERMINAL_RESTART_TYPE = "restart";

export class CodeIndicatorTerminalViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private view: vscode.WebviewView | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly session: PtyTerminalSession
  ) {
    this.disposables.push(
      toVsCodeDisposable(this.session.onData((data) => this.postMessage({ type: "data", data }))),
      toVsCodeDisposable(this.session.onStatus((status) => this.postStatus(status))),
      toVsCodeDisposable(this.session.onExit((event) => this.postMessage({ type: "exit", ...event })))
    );
  }

  get visible(): boolean {
    return this.view?.visible ?? false;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "media"),
        vscode.Uri.joinPath(this.extensionUri, "node_modules", "@xterm")
      ]
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    this.disposables.push(
      webviewView.onDidDispose(() => {
        if (this.view === webviewView) {
          this.view = undefined;
        }
      }),
      webviewView.webview.onDidReceiveMessage((message: unknown) => this.handleMessage(message))
    );

    this.session.ensureStarted();
  }

  dispose(): void {
    for (const disposable of this.disposables.splice(0)) {
      disposable.dispose();
    }
  }

  private handleMessage(message: unknown): void {
    if (!isRecord(message) || typeof message.type !== "string") {
      return;
    }

    switch (message.type) {
      case TERMINAL_READY_TYPE:
        this.postStatus(this.session.getStatus());
        this.postMessage({
          type: "data",
          data: this.session.getBufferedOutput()
        });
        break;
      case TERMINAL_INPUT_TYPE:
        if (typeof message.data === "string") {
          this.session.write(message.data);
        }
        break;
      case TERMINAL_RESIZE_TYPE:
        if (typeof message.cols === "number" && typeof message.rows === "number") {
          this.session.resize(message.cols, message.rows);
        }
        break;
      case TERMINAL_RESTART_TYPE:
        this.session.restart();
        break;
    }
  }

  private postStatus(status: TerminalSessionStatus): void {
    this.postMessage({
      type: "status",
      ...status
    });
  }

  private postMessage(message: unknown): void {
    void this.view?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const terminalScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "terminalView.js"));
    const terminalStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "terminalView.css"));
    const xtermScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "node_modules", "@xterm", "xterm", "lib", "xterm.js")
    );
    const xtermStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "node_modules", "@xterm", "xterm", "css", "xterm.css")
    );
    const fitScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "node_modules", "@xterm", "addon-fit", "lib", "addon-fit.js")
    );
    const csp = [
      "default-src 'none'",
      `script-src ${webview.cspSource} 'nonce-${nonce}'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      "img-src 'none'",
      "font-src 'none'"
    ].join("; ");

    return /* html */ `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${xtermStyleUri}">
  <link rel="stylesheet" href="${terminalStyleUri}">
  <title>Code Indicator</title>
</head>
<body>
  <main id="terminal" aria-label="Code Indicator Terminal"></main>
  <section id="statusPanel" class="status-panel" aria-live="polite">
    <span id="statusText">終端機啟動中</span>
    <button id="restartButton" type="button" hidden>重新啟動</button>
  </section>
  <script nonce="${nonce}" src="${xtermScriptUri}"></script>
  <script nonce="${nonce}" src="${fitScriptUri}"></script>
  <script nonce="${nonce}" src="${terminalScriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let index = 0; index < 32; index += 1) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toVsCodeDisposable(disposable: { dispose(): void }): vscode.Disposable {
  return {
    dispose: () => disposable.dispose()
  };
}
