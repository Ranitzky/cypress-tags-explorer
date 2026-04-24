import * as ts from 'typescript';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface TestInfo {
    id: string;
    name: string;
    type: 'describe' | 'context' | 'it';
    tags: string[];
    filePath: string;
    line: number;
    children: TestInfo[];
}

export class TagParser {
    private parsedEnumsCache = new Map<string, Map<string, string>>();

    public async parseWorkspace(): Promise<TestInfo[]> {
        const config = vscode.workspace.getConfiguration('tagsExplorer');
        const folder = config.get<string>('cypressFolder', 'cypress/e2e');
        const extensions = config.get<string>('fileExtensions', '*.cy.ts,*.cy.js');

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return [];

        const rootPath = workspaceFolders[0].uri.fsPath;
        const searchPattern = new vscode.RelativePattern(
            path.join(rootPath, folder),
            `**/{${extensions.split(',').map(e => e.trim()).join(',')}}`
        );

        const files = await vscode.workspace.findFiles(searchPattern);
        const results: TestInfo[] = [];

        for (const file of files) {
            const fileTests = this.parseFile(file.fsPath);
            results.push(...fileTests);
        }

        return results;
    }

    private parseFile(filePath: string): TestInfo[] {
        const sourceCode = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(
            filePath,
            sourceCode,
            ts.ScriptTarget.Latest,
            true
        );

        const imports = this.extractImports(sourceFile, filePath);
        const tests: TestInfo[] = [];

        const visit = (node: ts.Node, parentTags: string[]): TestInfo[] => {
            let currentTests: TestInfo[] = [];
            
            if (ts.isCallExpression(node)) {
                let expr = node.expression;
                let funcName = '';

                if (ts.isIdentifier(expr)) {
                    funcName = expr.text;
                } else if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) {
                    // e.g. describe.only, it.skip
                    funcName = expr.expression.text;
                }

                const validFuncs = ['describe', 'context', 'it', 'scenario', 'feature', 'Scenario', 'Feature'];

                if (validFuncs.includes(funcName)) {
                    const args = node.arguments;
                        if (args.length >= 2) {
                            const nameArg = args[0];
                            let name = 'Unknown';
                            if (ts.isStringLiteral(nameArg) || ts.isNoSubstitutionTemplateLiteral(nameArg)) {
                                name = nameArg.text;
                            } else if (ts.isTemplateExpression(nameArg)) {
                                name = nameArg.head.text + '...';
                            }

                            let tags: string[] = [];
                            let optionsArg: ts.Expression | undefined;

                            if (args.length === 3 && ts.isObjectLiteralExpression(args[1])) {
                                optionsArg = args[1];
                            } else if (args.length === 2 && ts.isObjectLiteralExpression(args[1])) {
                                // Sometimes users might just pass options, though usually it's name, options, fn
                                optionsArg = args[1];
                            }

                            if (optionsArg && ts.isObjectLiteralExpression(optionsArg)) {
                                const tagsProp = optionsArg.properties.find(
                                    (p) => p.name && ts.isIdentifier(p.name) && p.name.text === 'tags'
                                );

                                if (tagsProp && ts.isPropertyAssignment(tagsProp)) {
                                    tags = this.extractTagsFromExpression(tagsProp.initializer, imports, filePath);
                                }
                            }

                            const combinedTags = Array.from(new Set([...parentTags, ...tags]));
                            const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart());

                            const testInfo: TestInfo = {
                                id: `${filePath}:${lineAndChar.line}`,
                                name,
                                type: funcName as any,
                                tags: combinedTags,
                                filePath,
                                line: lineAndChar.line,
                                children: []
                            };

                            // Check body
                            const bodyArg = args[args.length - 1];
                            if (ts.isArrowFunction(bodyArg) || ts.isFunctionExpression(bodyArg)) {
                                ts.forEachChild(bodyArg.body, (child) => {
                                    const childTests = visit(child, combinedTags);
                                    testInfo.children.push(...childTests);
                                });
                            }
                            
                            currentTests.push(testInfo);
                            return currentTests;
                        }
                    }
                }

            ts.forEachChild(node, (child) => {
                currentTests.push(...visit(child, parentTags));
            });

            return currentTests;
        };

        ts.forEachChild(sourceFile, (node) => {
            tests.push(...visit(node, []));
        });

        return tests;
    }

    private extractTagsFromExpression(expr: ts.Expression, imports: Map<string, string>, currentFilePath: string): string[] {
        const tags: string[] = [];

        if (ts.isArrayLiteralExpression(expr)) {
            for (const elem of expr.elements) {
                tags.push(...this.extractTagsFromExpression(elem, imports, currentFilePath));
            }
        } else if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
            tags.push(expr.text);
        } else if (ts.isPropertyAccessExpression(expr)) {
            // e.g. prio.HIGH
            if (ts.isIdentifier(expr.expression)) {
                const enumName = expr.expression.text;
                const enumMember = expr.name.text;
                
                // resolve
                const resolvedValue = this.resolveEnumValue(enumName, enumMember, imports, currentFilePath);
                if (resolvedValue) {
                    tags.push(resolvedValue);
                } else {
                    // Fallback to string representation if we can't resolve it
                    tags.push(`${enumName}.${enumMember}`);
                }
            }
        } else if (ts.isIdentifier(expr)) {
             // Maybe it's just a variable or an enum imported directly? 
             // Less common for Cypress tags, usually it's enum.MEMBER
        }

        return tags;
    }

    private resolveEnumValue(enumName: string, enumMember: string, imports: Map<string, string>, currentFilePath: string): string | null {
        // Find if enum is imported
        let targetFilePath = currentFilePath;
        let isImported = false;

        for (const [importPath, namedImports] of imports.entries()) {
            if (namedImports.split(',').includes(enumName)) {
                // Resolve path
                const dir = path.dirname(currentFilePath);
                const exts = ['.ts', '.js', '/index.ts', '/index.js'];
                for (const ext of exts) {
                    const fullPath = path.join(dir, importPath + ext);
                    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                        targetFilePath = fullPath;
                        isImported = true;
                        break;
                    }
                }
                break;
            }
        }

        const cacheKey = `${targetFilePath}:${enumName}`;
        if (this.parsedEnumsCache.has(cacheKey)) {
            return this.parsedEnumsCache.get(cacheKey)?.get(enumMember) || null;
        }

        if (isImported || targetFilePath === currentFilePath) {
            const enumMap = this.parseEnumFile(targetFilePath, enumName);
            this.parsedEnumsCache.set(cacheKey, enumMap);
            return enumMap.get(enumMember) || null;
        }

        return null;
    }

    private parseEnumFile(filePath: string, enumName: string): Map<string, string> {
        const enumMap = new Map<string, string>();
        if (!fs.existsSync(filePath)) return enumMap;

        const sourceCode = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);

        const visit = (node: ts.Node) => {
            if (ts.isEnumDeclaration(node) && node.name.text === enumName) {
                for (const member of node.members) {
                    if (ts.isIdentifier(member.name)) {
                        let val = member.name.text;
                        if (member.initializer && ts.isStringLiteral(member.initializer)) {
                            val = member.initializer.text;
                        }
                        enumMap.set(member.name.text, val);
                    }
                }
            } else if (ts.isVariableStatement(node)) {
                 // Support const enum-like objects: const prio = { HIGH: '@high' }
                 for (const decl of node.declarationList.declarations) {
                     if (ts.isIdentifier(decl.name) && decl.name.text === enumName) {
                         if (decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
                             for (const prop of decl.initializer.properties) {
                                 if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                                     let val = prop.name.text;
                                     if (ts.isStringLiteral(prop.initializer)) {
                                         val = prop.initializer.text;
                                     }
                                     enumMap.set(prop.name.text, val);
                                 }
                             }
                         }
                     }
                 }
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return enumMap;
    }

    private extractImports(sourceFile: ts.SourceFile, filePath: string): Map<string, string> {
        const imports = new Map<string, string>(); // path -> comma separated named imports

        const visit = (node: ts.Node) => {
            if (ts.isImportDeclaration(node)) {
                if (ts.isStringLiteral(node.moduleSpecifier)) {
                    const modulePath = node.moduleSpecifier.text;
                    const importClause = node.importClause;
                    if (importClause && importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
                        const names = importClause.namedBindings.elements.map(e => e.name.text);
                        imports.set(modulePath, names.join(','));
                    }
                }
            }
            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return imports;
    }
}
