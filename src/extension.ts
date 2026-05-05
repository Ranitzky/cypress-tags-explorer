import * as vscode from 'vscode';
import { TagExplorerPanel } from './webview/TagExplorerPanel.js';
import { TagParser } from './parser.js';
import { TagsTreeProvider } from './tree/TagsTreeProvider.js';

export function activate(context: vscode.ExtensionContext) {
  const openCmd = vscode.commands.registerCommand('tags-explorer.open', () => {
    TagExplorerPanel.render(context.extensionUri);
  });

  context.subscriptions.push(openCmd);

  // Initialize Tree Providers
  const tagsProvider = new TagsTreeProvider();

  const tagsTreeView = vscode.window.createTreeView('tags-explorer-tags', {
    treeDataProvider: tagsProvider
  });

  // Set default context for the toggle
  vscode.commands.executeCommand('setContext', 'tagsExplorer.viewAsTree', true);

  // Helper to load data
  const loadTreeData = async () => {
    const parser = new TagParser();
    const rawTests = await parser.parseWorkspace();

    // Flatten tests for tags and files view
    const flattenTests = (tests: any[], parentNames: string[] = []): any[] => {
      let flat: any[] = [];
      for (const t of tests) {
        const currentNames = [...parentNames, t.name];
        t.fullName = currentNames.join(' > ');
        flat.push(t);
        if (t.children && t.children.length > 0) {
          flat.push(...flattenTests(t.children, currentNames));
        }
      }
      return flat;
    };
    
    const flatTests = flattenTests(rawTests);

    tagsProvider.refresh(flatTests);
  };

  // Initial load
  loadTreeData();

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('tags-explorer.refresh', () => {
      loadTreeData();
    }),
    vscode.commands.registerCommand('tags-explorer.toggleViewAsTree', () => {
      tagsProvider.toggleView();
    }),
    vscode.commands.registerCommand('tags-explorer.toggleViewAsList', () => {
      tagsProvider.toggleView();
    }),
    vscode.commands.registerCommand('tags-explorer.openTest', async (filePath: string, line: number) => {
      const uri = vscode.Uri.file(filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);
      const pos = new vscode.Position(line, 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos));
    }),
    vscode.commands.registerCommand('tags-explorer.filterTags', async () => {
      const currentFilter = tagsProvider.filterText;
      const filter = await vscode.window.showInputBox({
        prompt: 'Filter tags (e.g. @smoke AND @critical)',
        value: currentFilter
      });
      if (filter !== undefined) {
        tagsProvider.setFilter(filter);
        tagsTreeView.message = filter ? `Active Filter: ${filter}` : '';
      }
    }),
    vscode.commands.registerCommand('tags-explorer.editFilter', async () => {
      const currentFilter = tagsProvider.filterText;
      const filter = await vscode.window.showInputBox({
        prompt: 'Edit filter (e.g. @smoke AND @critical)',
        value: currentFilter
      });
      if (filter !== undefined) {
        tagsProvider.setFilter(filter);
        tagsTreeView.message = filter ? `Active Filter: ${filter}` : '';
      }
    }),
    vscode.commands.registerCommand('tags-explorer.clearFilter', () => {
      tagsProvider.setFilter('');
      tagsTreeView.message = '';
    })
  );
}

export function deactivate() {}
