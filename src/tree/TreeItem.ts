import * as vscode from 'vscode';

export class BaseTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue?: string
    ) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
    }
}

export class TagTreeItem extends BaseTreeItem {
    constructor(
        public readonly tag: string,
        public readonly count: number,
        collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(tag, collapsibleState, 'tag');
        this.description = count.toString();
        this.iconPath = new vscode.ThemeIcon('tag');
    }
}

export class FileTreeItem extends BaseTreeItem {
    constructor(
        public readonly filePath: string,
        public readonly fileName: string,
        collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(fileName, collapsibleState, 'file');
        this.tooltip = filePath;
        this.iconPath = new vscode.ThemeIcon('file');
    }
}

export class TestCaseTreeItem extends BaseTreeItem {
    constructor(
        public readonly test: any,
        collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(test.name, collapsibleState, 'testCase');
        this.description = test.tags ? test.tags.join(', ') : '';
        this.iconPath = new vscode.ThemeIcon(test.type === 'it' ? 'symbol-method' : 'symbol-namespace');
        
        if (test.type === 'it' || collapsibleState === vscode.TreeItemCollapsibleState.None) {
            this.command = {
                command: 'tags-explorer.openTest',
                title: 'Open Test',
                arguments: [test.filePath, test.line]
            };
        }
    }
}
