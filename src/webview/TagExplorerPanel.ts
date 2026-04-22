import * as vscode from 'vscode';
import { TagParser, TestInfo } from '../parser.js';
import { TagModifier } from '../modifier.js';

export class TagExplorerPanel {
    public static currentPanel: TagExplorerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview, extensionUri);
        this._setWebviewMessageListener(this._panel.webview);
    }

    public static render(extensionUri: vscode.Uri) {
        if (TagExplorerPanel.currentPanel) {
            TagExplorerPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'tagsExplorer',
                'Cypress Tags Explorer',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')]
                }
            );

            TagExplorerPanel.currentPanel = new TagExplorerPanel(panel, extensionUri);
        }
    }

    public dispose() {
        TagExplorerPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) d.dispose();
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Cypress Tags Explorer</title>
                <script type="module" src="${scriptUri}"></script>
                <style>
                    body {
                        padding: 20px;
                        font-family: var(--vscode-font-family);
                    }
                    .container { display: flex; flex-direction: column; gap: 20px; }
                    details[open] .tag-arrow {
                        transform: rotate(90deg);
                    }
                </style>
            </head>
            <body>
                <div id="app">Loading...</div>
            </body>
            </html>`;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case 'loadData':
                        await this._loadData();
                        break;
                    case 'openTest':
                        const uri = vscode.Uri.file(message.filePath);
                        const doc = await vscode.workspace.openTextDocument(uri);
                        const editor = await vscode.window.showTextDocument(doc);
                        const pos = new vscode.Position(message.line, 0);
                        editor.selection = new vscode.Selection(pos, pos);
                        editor.revealRange(new vscode.Range(pos, pos));
                        break;
                    case 'renameTag':
                        await TagModifier.renameTag(message.oldTag, message.newTag, message.files);
                        await this._loadData();
                        vscode.window.showInformationMessage(`Tag ${message.oldTag} renamed to ${message.newTag}`);
                        break;
                }
            },
            undefined,
            this._disposables
        );
    }

    private async _loadData() {
        const parser = new TagParser();
        const tests = await parser.parseWorkspace();
        this._panel.webview.postMessage({ command: 'dataLoaded', tests });
    }
}
