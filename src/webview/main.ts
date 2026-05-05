import { provideVSCodeDesignSystem, vsCodeBadge, vsCodeButton, vsCodeCheckbox, vsCodeDivider, vsCodePanels, vsCodePanelTab, vsCodePanelView, vsCodeTextField } from '@vscode/webview-ui-toolkit';
import { buildTagTree, TagNode } from '../tree/TagHierarchyBuilder.js';
import { matchesTagExpression } from '../utils/filterParser.js';

provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodePanels(),
  vsCodePanelTab(),
  vsCodePanelView(),
  vsCodeTextField(),
  vsCodeDivider(),
  vsCodeBadge(),
  vsCodeCheckbox()
);

declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();

let testsData: any[] = [];
let editingTag: string | null = null;

let filterText = '';
let filterTags = true;
let filterFilenames = true;
let filterTestTitles = true;
let viewAsTree = true;

window.addEventListener('load', () => {
    const filterInput = document.getElementById('filter-input') as any;
    if (filterInput) {
        filterInput.addEventListener('input', (e: any) => {
            filterText = e.target.value;
            render();
        });
    }

    ['tags', 'filenames', 'titles'].forEach(opt => {
        const cb = document.getElementById(`filter-opt-${opt}`) as any;
        if (cb) {
            cb.addEventListener('change', (e: any) => {
                if (opt === 'tags') filterTags = e.target.checked;
                if (opt === 'filenames') filterFilenames = e.target.checked;
                if (opt === 'titles') filterTestTitles = e.target.checked;
                render();
            });
        }
    });

    const treeCb = document.getElementById('view-opt-tree') as any;
    if (treeCb) {
        treeCb.addEventListener('change', (e: any) => {
            viewAsTree = e.target.checked;
            render();
        });
    }
});

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'dataLoaded':
            testsData = message.tests;
            editingTag = null;
            render();
            break;
    }
});

function flattenTests(tests: any[], parentNames: string[] = []): any[] {
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
}

function matchesFilter(t: any): boolean {
    if (!filterText) return true;
    const lowerFilter = filterText.toLowerCase();
    const testTags: string[] = t.tags ?? [];

    if (filterTags) {
        if (matchesTagExpression(testTags, filterText)) return true;
    }
    if (filterFilenames && t.filePath && t.filePath.toLowerCase().includes(lowerFilter)) {
        return true;
    }
    if (filterTestTitles && t.fullName && t.fullName.toLowerCase().includes(lowerFilter)) {
        return true;
    }
    return false;
}

function renderTagNode(node: TagNode, depth: number = 0): string {
    const testsHtml = node.tests.map((t: any) => {
        let belongsToChild = false;
        if (viewAsTree) {
            for (const child of node.children) {
                if (child.tests.some((ct: any) => ct.filePath === t.filePath && ct.line === t.line)) {
                    belongsToChild = true;
                    break;
                }
            }
        }
        if (viewAsTree && belongsToChild) return '';

        return `
            <div style="margin-left: 15px; padding: 5px; border-left: 2px solid var(--vscode-focusBorder); cursor: pointer;" class="test-item" data-filepath="${t.filePath}" data-line="${t.line}">
                <span style="color: var(--vscode-symbolIcon-methodForeground);">${t.type}</span>: ${t.name}
                <div style="font-size: 11px; opacity: 0.7;">${t.filePath.split('/').pop()}:${t.line + 1}</div>
            </div>
        `;
    }).join('');

    const childrenHtml = node.children.map(child => renderTagNode(child, depth + 1)).join('');

    let tagHeader = `
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--vscode-editor-inactiveSelectionBackground); padding: 5px 10px; border-radius: 3px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="font-size: 14px;"><span class="tag-arrow" style="display: inline-block; transition: transform 0.2s;">▶</span> ${node.tag} <vscode-badge>${node.tests.length}</vscode-badge></strong>
            </div>
            <vscode-button appearance="icon" aria-label="Rename" title="Rename" class="rename-btn" data-tag="${node.tag}">
                <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M13.23 1zM11.5 2.73l-8.26 8.27L2 14l3-1.24 8.27-8.26-1.77-1.77zM4.15 12.02l-1.32.55.55-1.32L10.74 3.9 12.1 5.26 4.15 12.02z"/></svg>
            </vscode-button>
        </div>
    `;

    if (editingTag === node.tag) {
        tagHeader = `
            <div style="display: flex; align-items: center; gap: 10px; background: var(--vscode-editor-inactiveSelectionBackground); padding: 5px 10px; border-radius: 3px;" onclick="event.stopPropagation();">
                <vscode-text-field id="rename-input-${node.tag}" value="${node.tag}" onclick="event.stopPropagation();"></vscode-text-field>
                <vscode-button appearance="primary" class="save-btn" data-tag="${node.tag}">Save</vscode-button>
                <vscode-button appearance="secondary" class="cancel-btn">Cancel</vscode-button>
            </div>
        `;
    }

    return `
        <details open style="margin-bottom: 10px; margin-left: ${depth * 15}px;">
            <summary style="cursor: pointer; list-style: none; user-select: none;">
                ${tagHeader}
            </summary>
            <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 10px; margin-bottom: 15px; margin-left: 5px;">
                ${testsHtml}
                ${childrenHtml}
            </div>
        </details>
    `;
}

function render() {
    const app = document.getElementById('app')!;
    const flatTests = flattenTests(testsData);

    const filteredTests = flatTests.filter(matchesFilter);
    const tagRoots = buildTagTree(filteredTests, viewAsTree);

    let untaggedTests: any[] = [];
    let htmlTags = '';

    for (const node of tagRoots) {
        if (node.tag === '[Untagged]') {
            untaggedTests = node.tests;
        } else {
            htmlTags += renderTagNode(node);
        }
    }

    let html = `
        <vscode-panels>
            <vscode-panel-tab id="tab-tags">TAGS</vscode-panel-tab>
            <vscode-panel-tab id="tab-untagged">UNTAGGED TESTS <vscode-badge appearance="secondary">${untaggedTests.length}</vscode-badge></vscode-panel-tab>

            <vscode-panel-view id="view-tags">
                <div style="width: 100%; display: flex; flex-direction: column; gap: 15px;">
                    ${htmlTags}
                </div>
            </vscode-panel-view>
            <vscode-panel-view id="view-untagged">
                <div style="width: 100%; display: flex; flex-direction: column; gap: 10px;">
    `;

    for (const t of untaggedTests) {
         html += `
            <div style="padding: 5px; border-left: 2px solid var(--vscode-focusBorder); cursor: pointer;" class="test-item" data-filepath="${t.filePath}" data-line="${t.line}">
                <span style="color: var(--vscode-symbolIcon-methodForeground);">${t.type}</span>: ${t.name}
                <div style="font-size: 11px; opacity: 0.7;">${t.filePath.split('/').pop()}:${t.line + 1}</div>
            </div>
        `;
    }

    html += `
                </div>
            </vscode-panel-view>
        </vscode-panels>
    `;

    app.innerHTML = html;

    // Attach listeners
    app.querySelectorAll('.test-item').forEach(el => {
        el.addEventListener('click', (e) => {
            const filepath = (e.currentTarget as HTMLElement).getAttribute('data-filepath');
            const line = (e.currentTarget as HTMLElement).getAttribute('data-line');
            if (filepath && line) {
                vscode.postMessage({
                    command: 'openTest',
                    filePath: filepath,
                    line: parseInt(line, 10)
                });
            }
        });
    });

    app.querySelectorAll('.rename-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            editingTag = (e.currentTarget as HTMLElement).getAttribute('data-tag');
            render();
        });
    });

    app.querySelectorAll('.cancel-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            editingTag = null;
            render();
        });
    });

    app.querySelectorAll('.save-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const oldTag = (e.currentTarget as HTMLElement).getAttribute('data-tag');
            const input = document.getElementById(`rename-input-${oldTag}`) as any;
            if (oldTag && input && input.value) {
                const newTag = input.value;
                const flatTests = flattenTests(testsData);
                const files = flatTests.filter(ft => ft.tags && ft.tags.includes(oldTag)).map(ft => ft.filePath);
                const uniqueFiles = Array.from(new Set(files));
                vscode.postMessage({
                    command: 'renameTag',
                    oldTag: oldTag,
                    newTag: newTag,
                    files: uniqueFiles
                });
            }
        });
    });
}

// Initial Load
vscode.postMessage({ command: 'loadData' });
