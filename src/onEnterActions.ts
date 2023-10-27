import { defaultJsSupersetLangsWithVue } from '@zardoy/vscode-utils/build/langs'
import * as vscode from 'vscode'
export default () => {
    vscode.workspace.onDidChangeTextDocument(({ contentChanges, document, reason }) => {
        if (
            !contentChanges.length ||
            !vscode.languages.match(defaultJsSupersetLangsWithVue, document) ||
            vscode.workspace.fs.isWritableFileSystem(document.uri.scheme) === false
        )
            return
        if (document.languageId === 'vue') return // todo
        const importRegex = /^\s*import\((['"].*['"])\) from (['"].*['"])$/
        // const prevLine = 
    })
}
