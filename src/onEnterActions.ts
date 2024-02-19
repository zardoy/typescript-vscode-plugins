import * as vscode from 'vscode'
import { defaultJsSupersetLangsWithVue } from '@zardoy/vscode-utils/build/langs'

export default () => {
    vscode.workspace.onDidChangeTextDocument(({ contentChanges, document, reason }) => {
        if (
            contentChanges.length === 0 ||
            !vscode.languages.match(defaultJsSupersetLangsWithVue, document) ||
            vscode.workspace.fs.isWritableFileSystem(document.uri.scheme) === false
        ) {
            return
        }

        if (!contentChanges.some(change => !isEol(change.text))) return
        // if (document.languageId === 'vue') return // todo
        const importRegex = /^\s*import(.*) from (['"].*['"])/gi
        const prevLine = document.lineAt(contentChanges[0]!.range.start.line)
        if (importRegex.test(prevLine.text)) {
            const lines = document.getText().split('\n')
            let lineToInsert = 0
            for (const [i, line] of lines.entries()) {
                if (!line.trim() || line.trim().startsWith('import') || line.trim().startsWith('require') || /^(#|\/\/|\/\*)/.test(line)) continue
                lineToInsert = i
                break
            }

            const editor = vscode.window.activeTextEditor!
            void editor.edit(b => {
                b.delete(prevLine.rangeIncludingLineBreak)
                b.insert(new vscode.Position(lineToInsert, 0), `${prevLine.text.trim()}\n`)
            })
        }
    })
}

const isEol = (text: string) => (text.startsWith('/n') || text.startsWith('/r/n')) && text.trim() === ''
