import * as vscode from 'vscode';
import { BaseTreeItem, TagTreeItem, TestCaseTreeItem } from './TreeItem.js';
import { TagNode, buildTagTree } from './TagHierarchyBuilder.js';

export class TagsTreeProvider implements vscode.TreeDataProvider<BaseTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BaseTreeItem | undefined | void> = new vscode.EventEmitter<BaseTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<BaseTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    private flatTests: any[] = [];
    public viewAsTree: boolean = true;

    refresh(flatTests: any[]): void {
        this.flatTests = flatTests;
        this._onDidChangeTreeData.fire();
    }

    toggleView(): void {
        this.viewAsTree = !this.viewAsTree;
        vscode.commands.executeCommand('setContext', 'tagsExplorer.viewAsTree', this.viewAsTree);
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BaseTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: BaseTreeItem): Thenable<BaseTreeItem[]> {
        if (!element) {
            const rootNodes = buildTagTree(this.flatTests, this.viewAsTree);
            return Promise.resolve(rootNodes.map(node => new TagNodeWrapper(node)));
        } else if (element instanceof TagNodeWrapper) {
            const items: BaseTreeItem[] = [];
            // Add child tags
            if (element.node.children) {
                items.push(...element.node.children.map(node => new TagNodeWrapper(node)));
            }
            // Add tests that match exactly this tag (and aren't subsumed by children, or we can just list all tests for this tag)
            // Wait, if it's a tree, we list tests that are associated with this tag.
            // If the user wants to see the tests, they are under the tag.
            // But tests might have children if we show them? No, tests here are `it` blocks usually.
            // Let's list tests if there are no child tags, OR maybe we should list them anyway?
            // To prevent massive duplication, we could list tests that have THIS tag but NOT any child tag.
            // For simplicity, just list all tests that belong to this tag.
            // To distinguish tests from tags, tests will use TestCaseTreeItem.
            const uniqueTests = new Map<string, any>();
            for (const test of element.node.tests) {
                // If viewAsTree, filter out tests that belong to any child tag to avoid duplication?
                // Actually, Cypress runner shows counts, but when you click a tag, it filters.
                // In a tree, if we click a tag, it should just expand.
                let belongsToChild = false;
                if (this.viewAsTree) {
                    for (const child of element.node.children) {
                        if (child.tests.some((t: any) => t.filePath === test.filePath && t.line === test.line)) {
                            belongsToChild = true;
                            break;
                        }
                    }
                }
                
                if (!this.viewAsTree || !belongsToChild) {
                    const id = `${test.filePath}:${test.line}`;
                    if (!uniqueTests.has(id)) uniqueTests.set(id, test);
                }
            }

            for (const test of uniqueTests.values()) {
                items.push(new TestCaseTreeItem(test, vscode.TreeItemCollapsibleState.None));
            }

            return Promise.resolve(items);
        }
        return Promise.resolve([]);
    }
}

class TagNodeWrapper extends TagTreeItem {
    constructor(public readonly node: TagNode) {
        super(
            node.tag, 
            node.tests.length, 
            (node.children.length > 0 || node.tests.length > 0) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
        );
    }
}
