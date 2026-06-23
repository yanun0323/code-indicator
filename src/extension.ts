import * as vscode from "vscode";
import os from "node:os";

import { PtyTerminalSession } from "./ptyTerminalSession";
import { formatSelectionLocation } from "./selectionLocation";
import { sendLocationToTerminal } from "./terminalRouting";
import { CodeIndicatorTerminalViewProvider } from "./terminalViewProvider";

const SEND_COMMAND = "codeIndicator.sendSelectionLocationToActiveTerminal";
const COPY_COMMAND = "codeIndicator.copySelectionLocation";
const COPY_AND_SEND_COMMAND = "codeIndicator.copySelectionLocationAndSendToActiveTerminal";
const TOGGLE_VIEW_COMMAND = "codeIndicator.toggleView";
const PANEL_VIEW_ID = "codeIndicator.panel";
const PANEL_FOCUS_COMMAND = `${PANEL_VIEW_ID}.focus`;
const PANEL_OPEN_COMMAND = `${PANEL_VIEW_ID}.open`;
const CLOSE_PRIMARY_SIDEBAR_COMMAND = "workbench.action.closeSidebar";
const VIEW_TOGGLE_SETTLE_MS = 100;
let terminalSession: PtyTerminalSession | undefined;
let terminalViewProvider: CodeIndicatorTerminalViewProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  terminalSession = new PtyTerminalSession({
    cwdResolver: getTerminalStartupCwd
  });
  terminalViewProvider = new CodeIndicatorTerminalViewProvider(context.extensionUri, terminalSession);

  context.subscriptions.push(
    terminalSession,
    terminalViewProvider,
    vscode.window.registerWebviewViewProvider(PANEL_VIEW_ID, terminalViewProvider, {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }),
    vscode.commands.registerCommand(SEND_COMMAND, sendSelectionLocationToActiveTerminal),
    vscode.commands.registerCommand(COPY_COMMAND, copySelectionLocation),
    vscode.commands.registerCommand(COPY_AND_SEND_COMMAND, copySelectionLocationAndSendToActiveTerminal),
    vscode.commands.registerCommand(TOGGLE_VIEW_COMMAND, toggleCodeIndicatorView)
  );
}

export function deactivate(): void {
  terminalSession?.dispose();
  terminalSession = undefined;
  terminalViewProvider = undefined;
}

async function toggleCodeIndicatorView(): Promise<void> {
  if (!terminalViewProvider?.visible) {
    await vscode.commands.executeCommand(PANEL_FOCUS_COMMAND);
    return;
  }

  await vscode.commands.executeCommand(PANEL_FOCUS_COMMAND);
  await vscode.commands.executeCommand(PANEL_OPEN_COMMAND);
  await sleep(VIEW_TOGGLE_SETTLE_MS);

  if (terminalViewProvider.visible) {
    await vscode.commands.executeCommand(CLOSE_PRIMARY_SIDEBAR_COMMAND);
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function sendSelectionLocationToActiveTerminal(): Promise<void> {
  const selectionLocation = getActiveSelectionLocation();
  if (!selectionLocation) {
    return;
  }

  await sendToTerminal(selectionLocation);
}

async function copySelectionLocation(): Promise<void> {
  const selectionLocation = getActiveSelectionLocation();
  if (!selectionLocation) {
    return;
  }

  await copyToClipboard(selectionLocation);
}

async function copySelectionLocationAndSendToActiveTerminal(): Promise<void> {
  const selectionLocation = getActiveSelectionLocation();
  if (!selectionLocation) {
    return;
  }

  await copyToClipboard(selectionLocation);
  await sendToTerminal(selectionLocation);
}

function getActiveSelectionLocation(): string | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active editor.");
    return undefined;
  }

  const { document, selection } = editor;
  if (document.uri.scheme !== "file") {
    vscode.window.showWarningMessage("The current document is not a local file.");
    return undefined;
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

  return formatSelectionLocation({
    filePath: document.uri.fsPath,
    workspaceFolderPath: workspaceFolder?.uri.fsPath,
    selection: {
      start: {
        line: selection.start.line,
        character: selection.start.character
      },
      end: {
        line: selection.end.line,
        character: selection.end.character
      }
    }
  });
}

async function copyToClipboard(value: string): Promise<void> {
  await vscode.env.clipboard.writeText(value);
  vscode.window.showInformationMessage("Location copied.");
}

async function sendToTerminal(value: string): Promise<void> {
  await sendLocationToTerminal({
    value,
    trailingCharacter: getTerminalTrailingCharacter(),
    focusAfterSend: shouldFocusTerminalAfterSend(),
    embeddedTerminal: terminalSession,
    activeTerminal: vscode.window.activeTerminal,
    focusEmbeddedTerminal: focusCodeIndicatorView,
    warnNoActiveTerminal: () => vscode.window.showWarningMessage("No active terminal.")
  });
}

function getTerminalTrailingCharacter(): string {
  return vscode.workspace.getConfiguration("codeIndicator").get<string>("terminal.trailingCharacter", "space");
}

function shouldFocusTerminalAfterSend(): boolean {
  return vscode.workspace.getConfiguration("codeIndicator").get<boolean>("terminal.focusAfterSend", true);
}

async function focusCodeIndicatorView(): Promise<void> {
  await vscode.commands.executeCommand(PANEL_FOCUS_COMMAND);
}

function getTerminalStartupCwd(): string {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (workspaceFolder) {
      return workspaceFolder.uri.fsPath;
    }
  }

  const firstWorkspaceFolder = vscode.workspace.workspaceFolders?.[0];
  return firstWorkspaceFolder?.uri.fsPath ?? os.homedir();
}
