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
