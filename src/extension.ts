import * as vscode from 'vscode';
import { TagExplorerPanel } from './webview/TagExplorerPanel.js';

export function activate(context: vscode.ExtensionContext) {
  const openCmd = vscode.commands.registerCommand('tags-explorer.open', () => {
    TagExplorerPanel.render(context.extensionUri);
  });

  context.subscriptions.push(openCmd);
}

export function deactivate() {}
