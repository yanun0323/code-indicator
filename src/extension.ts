import * as vscode from "vscode";
import { formatSelectionLocation } from "./selectionLocation";
import { getTerminalSendText } from "./terminalSendText";

const SEND_COMMAND = "codeIndicator.sendSelectionLocationToActiveTerminal";
const COPY_COMMAND = "codeIndicator.copySelectionLocation";
const COPY_AND_SEND_COMMAND = "codeIndicator.copySelectionLocationAndSendToActiveTerminal";
const TOGGLE_VIEW_COMMAND = "codeIndicator.toggleView";
const PANEL_VIEW_ID = "codeIndicator.panel";
const PANEL_FOCUS_COMMAND = `${PANEL_VIEW_ID}.focus`;
const PANEL_OPEN_COMMAND = `${PANEL_VIEW_ID}.open`;
const CLOSE_PRIMARY_SIDEBAR_COMMAND = "workbench.action.closeSidebar";
const VIEW_TOGGLE_SETTLE_MS = 100;

export function activate(context: vscode.ExtensionContext): void {
  const treeView = vscode.window.createTreeView(PANEL_VIEW_ID, {
    treeDataProvider: new EmptyCodeIndicatorProvider()
  });

  context.subscriptions.push(
    treeView,
    vscode.commands.registerCommand(SEND_COMMAND, sendSelectionLocationToActiveTerminal),
    vscode.commands.registerCommand(COPY_COMMAND, copySelectionLocation),
    vscode.commands.registerCommand(COPY_AND_SEND_COMMAND, copySelectionLocationAndSendToActiveTerminal),
    vscode.commands.registerCommand(TOGGLE_VIEW_COMMAND, () => toggleCodeIndicatorView(treeView))
  );
}

export function deactivate(): void {
  // No resources to dispose.
}

class EmptyCodeIndicatorProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getChildren(): vscode.TreeItem[] {
    return [];
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
}

async function toggleCodeIndicatorView(treeView: vscode.TreeView<vscode.TreeItem>): Promise<void> {
  if (!treeView.visible) {
    await vscode.commands.executeCommand(PANEL_FOCUS_COMMAND);
    return;
  }

  await vscode.commands.executeCommand(PANEL_FOCUS_COMMAND);
  await vscode.commands.executeCommand(PANEL_OPEN_COMMAND);
  await sleep(VIEW_TOGGLE_SETTLE_MS);

  if (treeView.visible) {
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

  sendToActiveTerminal(selectionLocation);
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
  sendToActiveTerminal(selectionLocation);
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

function sendToActiveTerminal(value: string): void {
  const terminal = vscode.window.activeTerminal;
  if (!terminal) {
    vscode.window.showWarningMessage("No active terminal.");
    return;
  }

  const sendText = getTerminalSendText(value, getTerminalTrailingCharacter());
  terminal.sendText(sendText.text, sendText.addNewLine);
  if (shouldFocusTerminalAfterSend()) {
    terminal.show(false);
  }
}

function getTerminalTrailingCharacter(): string {
  return vscode.workspace.getConfiguration("codeIndicator").get<string>("terminal.trailingCharacter", "space");
}

function shouldFocusTerminalAfterSend(): boolean {
  return vscode.workspace.getConfiguration("codeIndicator").get<boolean>("terminal.focusAfterSend", true);
}
