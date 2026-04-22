import * as ts from 'typescript';
import * as vscode from 'vscode';
import * as fs from 'fs';

export class TagModifier {
    public static async renameTag(oldTag: string, newTag: string, files: string[]): Promise<void> {
        const edit = new vscode.WorkspaceEdit();

        for (const file of files) {
            const uri = vscode.Uri.file(file);
            const sourceCode = fs.readFileSync(file, 'utf-8');
            const sourceFile = ts.createSourceFile(file, sourceCode, ts.ScriptTarget.Latest, true);

            const visit = (node: ts.Node) => {
                if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
                    if (node.text === oldTag) {
                        // Check if it's inside a tags array or property
                        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart() + 1); // +1 for quote
                        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd() - 1);
                        
                        const range = new vscode.Range(start.line, start.character, end.line, end.character);
                        edit.replace(uri, range, newTag);
                    }
                } else if (ts.isPropertyAccessExpression(node)) {
                    // It could be an enum prio.HIGH, we don't easily rename enums across files unless we know it maps to oldTag.
                    // Renaming enums is complex, for now we only replace string literals.
                }
                ts.forEachChild(node, visit);
            };

            visit(sourceFile);
        }

        await vscode.workspace.applyEdit(edit);
        await vscode.workspace.saveAll();
    }
}
