import * as vscode from "vscode";

import {
  MAX_PASTED_IMAGE_BYTES,
  PASTED_IMAGE_READ_ERROR_MESSAGE,
  PASTED_IMAGE_TOO_LARGE_MESSAGE,
  PastedImageError,
  savePastedImage
} from "./pastedImage";
import { PtyTerminalSession, TerminalSessionStatus } from "./ptyTerminalSession";

const TERMINAL_READY_TYPE = "ready";
const TERMINAL_INPUT_TYPE = "input";
const TERMINAL_RESIZE_TYPE = "resize";
const TERMINAL_RESTART_TYPE = "restart";
const TERMINAL_FOCUS_CHANGED_TYPE = "focusChanged";
const TERMINAL_PASTE_IMAGE_TYPE = "pasteImage";
const TERMINAL_PASTE_IMAGE_READ_ERROR_TYPE = "pasteImageReadError";
const TERMINAL_PASTE_IMAGE_TOO_LARGE_TYPE = "pasteImageTooLarge";

export class CodeIndicatorTerminalViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private readonly visibilityEmitter = new vscode.EventEmitter<boolean>();
  private readonly focusEmitter = new vscode.EventEmitter<boolean>();
  private readonly disposables: vscode.Disposable[] = [];
  private view: vscode.WebviewView | undefined;
  private webviewReady = false;
  readonly onDidChangeVisibility = this.visibilityEmitter.event;
  readonly onDidChangeFocus = this.focusEmitter.event;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly session: PtyTerminalSession,
    private readonly startupCommandResolver: () => string | undefined = () => undefined
  ) {
    this.disposables.push(
      toVsCodeDisposable(
        this.session.onData((data) => {
          if (this.webviewReady) {
            this.postMessage({ type: "data", data });
          }
        })
      ),
      toVsCodeDisposable(this.session.onStatus((status) => this.postStatus(status))),
      toVsCodeDisposable(this.session.onExit((event) => this.postMessage({ type: "exit", ...event }))),
      toVsCodeDisposable(
        this.session.onClear(() => {
          if (this.webviewReady) {
            this.postMessage({ type: "clear" });
          }
        })
      )
    );
  }

  get visible(): boolean {
    return this.view?.visible ?? false;
  }

  focusTerminal(): void {
    this.postMessage({ type: "focus" });
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.webviewReady = false;
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
        this.webviewReady = false;
        this.visibilityEmitter.fire(false);
        this.focusEmitter.fire(false);
      }),
      webviewView.onDidChangeVisibility(() => {
        this.visibilityEmitter.fire(webviewView.visible);
        if (!webviewView.visible) {
          this.focusEmitter.fire(false);
        }
        if (webviewView.visible && this.webviewReady && this.session.getStatus().state === "stopped") {
          this.session.spawn({ startupCommand: this.startupCommandResolver() });
        }
      }),
      webviewView.webview.onDidReceiveMessage((message: unknown) => this.handleMessage(message))
    );

    this.visibilityEmitter.fire(webviewView.visible);
  }

  dispose(): void {
    for (const disposable of this.disposables.splice(0)) {
      disposable.dispose();
    }
    this.visibilityEmitter.dispose();
    this.focusEmitter.dispose();
  }

  private handleMessage(message: unknown): void {
    if (!isRecord(message) || typeof message.type !== "string") {
      return;
    }

    switch (message.type) {
      case TERMINAL_READY_TYPE:
        if (this.webviewReady) {
          this.postStatus(this.session.getStatus());
          break;
        }

        this.webviewReady = true;
        const startedForReadyView = this.startTerminalForReadyView();
        this.postStatus(this.session.getStatus());
        if (!startedForReadyView) {
          this.postMessage({
            type: "data",
            data: this.session.getBufferedOutput()
          });
        }
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
        this.session.restart({ startupCommand: this.startupCommandResolver() });
        break;
      case TERMINAL_FOCUS_CHANGED_TYPE:
        if (typeof message.focused === "boolean") {
          this.focusEmitter.fire(message.focused);
        }
        break;
      case TERMINAL_PASTE_IMAGE_TYPE:
        if (typeof message.mediaType === "string" && typeof message.base64 === "string") {
          void this.handlePastedImage(message.mediaType, message.base64);
        }
        break;
      case TERMINAL_PASTE_IMAGE_READ_ERROR_TYPE:
        void vscode.window.showErrorMessage(PASTED_IMAGE_READ_ERROR_MESSAGE);
        break;
      case TERMINAL_PASTE_IMAGE_TOO_LARGE_TYPE:
        void vscode.window.showErrorMessage(PASTED_IMAGE_TOO_LARGE_MESSAGE);
        break;
    }
  }

  private async handlePastedImage(mediaType: string, base64: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      void vscode.window.showErrorMessage("Open a workspace folder before you paste an image.");
      return;
    }

    if (!this.session.isLive()) {
      void vscode.window.showErrorMessage("Start the Code Indicator terminal before you paste an image.");
      return;
    }

    const configuration = vscode.workspace.getConfiguration("codeIndicator", workspaceFolder.uri);
    const customImageDirectory = configuration.get<boolean>("useCustomImageDirectory", false)
      ? configuration.get<string>("customImageDirectory", "")
      : undefined;

    try {
      const savedImage = await savePastedImage({
        projectDirectory: workspaceFolder.uri.fsPath,
        customImageDirectory,
        mediaType,
        base64
      });
      if (savedImage.usedFallbackDirectory) {
        void vscode.window.showWarningMessage(
          "Unable to use Custom Image Directory. Check the path and permissions. The image was saved in .tmp/images."
        );
      }
      if (!this.session.write(savedImage.markdown)) {
        void vscode.window.showErrorMessage(
          "The image was saved, but the terminal stopped before Code Indicator pasted the link. Start the terminal and paste the image again."
        );
      }
    } catch (error) {
      const message =
        error instanceof PastedImageError
          ? error.message
          : "Unable to save the pasted image. Check the workspace permissions and try again.";
      void vscode.window.showErrorMessage(message);
    }
  }

  private startTerminalForReadyView(): boolean {
    const state = this.session.getStatus().state;
    if (state === "idle" || state === "stopped") {
      return this.session.ensureStarted({ startupCommand: this.startupCommandResolver() });
    }

    return false;
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
  <main id="terminal" data-max-pasted-image-bytes="${MAX_PASTED_IMAGE_BYTES}" aria-label="Code Indicator Terminal"></main>
  <section id="statusPanel" class="status-panel" aria-live="polite">
    <span id="statusText">Terminal is starting</span>
    <button id="restartButton" type="button" hidden>Restart</button>
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
