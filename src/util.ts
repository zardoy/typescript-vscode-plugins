import * as vscode from 'vscode'
import { offsetPosition } from '@zardoy/vscode-utils/build/position'
import { showQuickPick } from '@zardoy/vscode-utils/build/quickPick'
import { Utils } from 'vscode-uri'
import { relative, join } from 'path-browserify'

const normalizeWindowPath = (path: string | undefined) => path?.replace(/\\/g, '/')

export const tsRangeToVscode = (document: vscode.TextDocument, [start, end]: [number, number]) =>
    new vscode.Range(document.positionAt(start), document.positionAt(end))

export const tsRangeToVscodeSelection = (document: vscode.TextDocument, [start, end]: [number, number]) =>
    new vscode.Selection(document.positionAt(start), document.positionAt(end))

export const tsTextChangesToVscodeTextEdits = (document: vscode.TextDocument, edits: Array<import('typescript').TextChange>): vscode.TextEdit[] =>
    edits.map(({ span, newText }) => {
        const start = document.positionAt(span.start)
        return {
            range: new vscode.Range(start, offsetPosition(document, start, span.length)),
            newText,
        }
    })

export const tsTextChangesToVscodeSnippetTextEdits = (document: vscode.TextDocument, edits: Array<import('typescript').TextChange>): vscode.SnippetTextEdit[] =>
    edits.map(({ span, newText }) => {
        const start = document.positionAt(span.start)
        return {
            range: new vscode.Range(start, offsetPosition(document, start, span.length)),
            snippet: new vscode.SnippetString(newText),
        }
    })

export const vscodeRangeToTs = (document: vscode.TextDocument, range: vscode.Range) =>
    [document.offsetAt(range.start), document.offsetAt(range.end)] as [number, number]

export const getTsLikePath = <T extends vscode.Uri | undefined>(uri: T): T extends undefined ? undefined : string =>
    uri && (normalizeWindowPath(uri.fsPath) as any)

// pick other file
export const pickFileWithQuickPick = async (fileNames: string[], optionsOverride?) => {
    const editorUri = vscode.window.activeTextEditor?.document.uri
    const editorFilePath = editorUri?.fsPath && getTsLikePath(editorUri)
    if (editorFilePath) fileNames = fileNames.filter(fileName => fileName !== editorFilePath)
    const currentWorkspacePath = editorUri && getTsLikePath(vscode.workspace.getWorkspaceFolder(editorUri)?.uri)
    const getItems = (filter?: string) => {
        const filterFilePath = filter && editorUri ? getTsLikePath(Utils.joinPath(editorUri, '..', filter)) : undefined
        const filtered = fileNames.filter(fileName => (filterFilePath ? fileName.startsWith(filterFilePath) : true))
        const relativePath = filterFilePath ? join(filterFilePath, '..') : currentWorkspacePath
        return filtered.map(fileName => {
            let label = relativePath ? relative(relativePath, fileName) : fileName
            if (filterFilePath && !label.startsWith('./') && !label.startsWith('../')) label = `./${label}`
            return {
                label,
                value: fileName,
                alwaysShow: !!filterFilePath,
                buttons: [
                    {
                        iconPath: new vscode.ThemeIcon('go-to-file'),
                        tooltip: 'Open file',
                    },
                ],
            }
        })
    }

    const selectedFile = await showQuickPick(getItems(), {
        title: 'Select file',
        onDidChangeValue(text) {
            this.items = ['../', './'].some(p => text.startsWith(p)) ? getItems(text) : getItems()
        },
        onDidTriggerItemButton(button) {
            if (button.button.tooltip === 'Open file') {
                void vscode.window.showTextDocument(vscode.Uri.file(button.item.value))
            }
        },
        ...optionsOverride,
    })
    return selectedFile
}
