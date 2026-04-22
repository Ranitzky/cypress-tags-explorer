import { provideVSCodeDesignSystem, vsCodeBadge, vsCodeButton, vsCodeDivider, vsCodePanels, vsCodePanelTab, vsCodePanelView, vsCodeTextField } from '@vscode/webview-ui-toolkit';

provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodePanels(),
  vsCodePanelTab(),
  vsCodePanelView(),
  vsCodeTextField(),
  vsCodeDivider(),
  vsCodeBadge()
);

const vscode = acquireVsCodeApi();

let testsData: any[] = [];
let editingTag: string | null = null;

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

function flattenTests(tests: any[]): any[] {
    let flat: any[] = [];
    for (const t of tests) {
        flat.push(t);
        if (t.children && t.children.length > 0) {
            flat.push(...flattenTests(t.children));
        }
    }
    return flat;
}

function render() {
    const app = document.getElementById('app')!;
    const flatTests = flattenTests(testsData);

    const tagsMap = new Map<string, any[]>();
    const untaggedTests: any[] = [];

    // Grouping
    for (const t of flatTests) {
        // Only count 'it' blocks for runnable tests, or all?
        // User said: "tests ohne tags bekommen eine eigene rubrik. tags werden vererbt, describe, context, it sind die 3 ebenen."
        // We will show 'it' blocks as the main tests, but also context/describe if they have tags and no children?
        // Let's just group all blocks that have tags.
        if (t.tags && t.tags.length > 0) {
            for (const tag of t.tags) {
                if (!tagsMap.has(tag)) tagsMap.set(tag, []);
                tagsMap.get(tag)!.push(t);
            }
        } else {
            if (t.type === 'it') {
                untaggedTests.push(t);
            }
        }
    }

    let html = `
        <vscode-panels>
            <vscode-panel-tab id="tab-tags">TAGS</vscode-panel-tab>
            <vscode-panel-tab id="tab-untagged">UNTAGGED TESTS <vscode-badge appearance="secondary">${untaggedTests.length}</vscode-badge></vscode-panel-tab>

            <vscode-panel-view id="view-tags">
                <div style="width: 100%; display: flex; flex-direction: column; gap: 15px;">
    `;

    const sortedTags = Array.from(tagsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    for (const [tag, tests] of sortedTags) {
        const testsHtml = tests.map((t: any) => `
            <div style="margin-left: 15px; padding: 5px; border-left: 2px solid var(--vscode-focusBorder); cursor: pointer;" class="test-item" data-filepath="${t.filePath}" data-line="${t.line}">
                <span style="color: var(--vscode-symbolIcon-methodForeground);">${t.type}</span>: ${t.name}
                <div style="font-size: 11px; opacity: 0.7;">${t.filePath.split('/').pop()}:${t.line + 1}</div>
            </div>
        `).join('');

        let tagHeader = `
            <div style="display: flex; align-items: center; justify-content: space-between; background: var(--vscode-editor-inactiveSelectionBackground); padding: 5px 10px; border-radius: 3px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <strong style="font-size: 14px;"><span class="tag-arrow" style="display: inline-block; transition: transform 0.2s;">▶</span> ${tag} <vscode-badge>${tests.length}</vscode-badge></strong>
                </div>
                <vscode-button appearance="icon" aria-label="Rename" title="Rename" class="rename-btn" data-tag="${tag}">
                    <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M13.23 1zM11.5 2.73l-8.26 8.27L2 14l3-1.24 8.27-8.26-1.77-1.77zM4.15 12.02l-1.32.55.55-1.32L10.74 3.9 12.1 5.26 4.15 12.02z"/></svg>
                </vscode-button>
            </div>
        `;

        if (editingTag === tag) {
            tagHeader = `
                <div style="display: flex; align-items: center; gap: 10px; background: var(--vscode-editor-inactiveSelectionBackground); padding: 5px 10px; border-radius: 3px;" onclick="event.stopPropagation();">
                    <vscode-text-field id="rename-input-${tag}" value="${tag}" onclick="event.stopPropagation();"></vscode-text-field>
                    <vscode-button appearance="primary" class="save-btn" data-tag="${tag}">Save</vscode-button>
                    <vscode-button appearance="secondary" class="cancel-btn">Cancel</vscode-button>
                </div>
            `;
        }

        html += `
            <details open style="margin-bottom: 10px;">
                <summary style="cursor: pointer; list-style: none; user-select: none;">
                    ${tagHeader}
                </summary>
                <div style="display: flex; flex-direction: column; gap: 5px; margin-top: 10px; margin-bottom: 15px; margin-left: 5px;">
                    ${testsHtml}
                </div>
            </details>
        `;
    }

    html += `
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
                const files = tagsMap.get(oldTag)?.map(t => t.filePath) || [];
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
