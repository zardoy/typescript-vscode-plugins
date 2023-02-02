import * as vscode from 'vscode'
import { defaultJsSupersetLangsWithVue } from '@zardoy/vscode-utils/build/langs'

export default () => {
    vscode.languages.registerCompletionItemProvider(
        defaultJsSupersetLangsWithVue,
        {
            provideCompletionItems(document, position, token, context) {
                const regex = /\/\/@?[\w-]*/
                let range = document.getWordRangeAtPosition(position, regex)
                if (!range) return
                const rangeText = document.getText(range)
                if (rangeText !== document.lineAt(position).text.trim()) {
                    return
                }

                range = range.with(range.start.translate(0, 2), range.end)
                const tsDirectives = ['@ts-format-ignore-line', '@ts-format-ignore-region', '@ts-format-ignore-endregion']
                return tsDirectives.map((directive, i) => {
                    const completionItem = new vscode.CompletionItem(directive, vscode.CompletionItemKind.Snippet)
                    completionItem.range = range
                    completionItem.sortText = `z${i}`
                    return completionItem
                })
            },
        },
        '@',
    )
}
