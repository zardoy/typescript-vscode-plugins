import delay from 'delay'
import { join } from 'path'
import * as vscode from 'vscode'

export const fromFixtures = (path: string) => join(__dirname, '../../integration/fixtures', path)

export const clearEditorText = async (editor: vscode.TextEditor, resetContent = '') => {
    await new Promise<void>(resolve => {
        const { document } = editor
        if (document.getText() === resetContent) {
            resolve()
            return
        }

        const { dispose } = vscode.workspace.onDidChangeTextDocument(({ document }) => {
            if (document.uri !== editor.document.uri) return
            dispose()
            resolve()
        })
        void editor.edit(builder =>
            builder.replace(new vscode.Range(new vscode.Position(0, 0), document.lineAt(document.lineCount - 1).range.end), resetContent),
        )
    })
}

export const replaceEditorText = async (editor: vscode.TextEditor, range: vscode.Range, text: string) => {
    await new Promise<void>(resolve => {
        const { document } = editor
        if (document.getText(range) === text) {
            resolve()
            return
        }

        // eslint-disable-next-line sonarjs/no-identical-functions
        const { dispose } = vscode.workspace.onDidChangeTextDocument(({ document }) => {
            if (document.uri !== editor.document.uri) return
            dispose()
            resolve()
        })
        void editor.edit(builder => builder.replace(range, text))
    })
}

// allow to use .only
let isFirstTsStart = true
export const prepareTsStart = async () => {
    await delay(200)
    if (!isFirstTsStart) return
    isFirstTsStart = false
    await delay(2000)
}
