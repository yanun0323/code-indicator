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
const SPAWN_TERMINAL_COMMAND = "codeIndicator.spawnTerminal";
const KILL_TERMINAL_COMMAND = "codeIndicator.killTerminal";
const RESTART_TERMINAL_COMMAND = "codeIndicator.restartTerminal";
const PANEL_VIEW_ID = "codeIndicator.panel";
const PANEL_FOCUS_COMMAND = `${PANEL_VIEW_ID}.focus`;
const VIEW_FOCUSED_CONTEXT = "codeIndicator.viewFocused";
const CLOSE_PRIMARY_SIDEBAR_COMMAND = "workbench.action.closeSidebar";
const TOGGLE_PRIMARY_SIDEBAR_COMMAND = "workbench.action.toggleSidebarVisibility";
const CLOSE_AUXILIARY_SIDEBAR_COMMAND = "workbench.action.closeAuxiliaryBar";
const TOGGLE_AUXILIARY_SIDEBAR_COMMAND = "workbench.action.toggleAuxiliaryBar";
let terminalSession: PtyTerminalSession | undefined;
let terminalViewProvider: CodeIndicatorTerminalViewProvider | undefined;
let codeIndicatorViewOpen = false;

export function activate(context: vscode.ExtensionContext): void {
  terminalSession = new PtyTerminalSession({
    cwdResolver: getTerminalStartupCwd
  });
  terminalViewProvider = new CodeIndicatorTerminalViewProvider(context.extensionUri, terminalSession);

  context.subscriptions.push(
    terminalSession,
    terminalViewProvider,
    {
      dispose: terminalSession.onStatus(updateTerminalLifecycleContext).dispose
    },
    terminalViewProvider.onDidChangeVisibility((visible) => {
      codeIndicatorViewOpen = visible;
      if (!visible) {
        updateViewFocusContext(false);
      }
    }),
    terminalViewProvider.onDidChangeFocus(updateViewFocusContext),
    vscode.window.registerWebviewViewProvider(PANEL_VIEW_ID, terminalViewProvider, {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }),
    vscode.commands.registerCommand(SEND_COMMAND, sendSelectionLocationToActiveTerminal),
    vscode.commands.registerCommand(COPY_COMMAND, copySelectionLocation),
    vscode.commands.registerCommand(COPY_AND_SEND_COMMAND, copySelectionLocationAndSendToActiveTerminal),
    vscode.commands.registerCommand(TOGGLE_VIEW_COMMAND, toggleCodeIndicatorView),
    vscode.commands.registerCommand(SPAWN_TERMINAL_COMMAND, spawnTerminal),
    vscode.commands.registerCommand(KILL_TERMINAL_COMMAND, killTerminal),
    vscode.commands.registerCommand(RESTART_TERMINAL_COMMAND, restartTerminal)
  );
  updateTerminalLifecycleContext(terminalSession.getStatus());
  updateViewFocusContext(false);
}

export function deactivate(): void {
  terminalSession?.dispose();
  terminalSession = undefined;
  terminalViewProvider = undefined;
  codeIndicatorViewOpen = false;
  updateViewFocusContext(false);
}

async function toggleCodeIndicatorView(): Promise<void> {
  if (!codeIndicatorViewOpen && !terminalViewProvider?.visible) {
    await focusCodeIndicatorView();
    spawnStoppedTerminal();
    return;
  }

  await closeCodeIndicatorView();
}

async function spawnTerminal(): Promise<void> {
  await focusCodeIndicatorView();
  terminalSession?.spawn();
}

async function killTerminal(): Promise<void> {
  terminalSession?.kill();
  await closeCodeIndicatorView();
}

async function restartTerminal(): Promise<void> {
  await focusCodeIndicatorView();
  terminalSession?.restart();
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

function updateTerminalLifecycleContext(status: ReturnType<PtyTerminalSession["getStatus"]>): void {
  void vscode.commands.executeCommand("setContext", "codeIndicator.terminalLive", status.state === "starting" || status.state === "ready");
}

function spawnStoppedTerminal(): void {
  if (terminalSession?.getStatus().state === "stopped") {
    terminalSession.spawn();
  }
}

async function closeCodeIndicatorView(): Promise<void> {
  await vscode.commands.executeCommand(CLOSE_PRIMARY_SIDEBAR_COMMAND);
  await vscode.commands.executeCommand(CLOSE_AUXILIARY_SIDEBAR_COMMAND);
  if (codeIndicatorViewOpen || terminalViewProvider?.visible) {
    await vscode.commands.executeCommand(TOGGLE_PRIMARY_SIDEBAR_COMMAND);
  }
  if (codeIndicatorViewOpen || terminalViewProvider?.visible) {
    await vscode.commands.executeCommand(TOGGLE_AUXILIARY_SIDEBAR_COMMAND);
  }
  codeIndicatorViewOpen = terminalViewProvider?.visible ?? false;
  updateViewFocusContext(false);
}

async function focusCodeIndicatorView(): Promise<void> {
  await vscode.commands.executeCommand(PANEL_FOCUS_COMMAND);
  codeIndicatorViewOpen = true;
  terminalViewProvider?.focusTerminal();
  updateViewFocusContext(true);
}

function updateViewFocusContext(focused: boolean): void {
  void vscode.commands.executeCommand("setContext", VIEW_FOCUSED_CONTEXT, focused);
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
