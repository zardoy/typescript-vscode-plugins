import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { watchExtensionSettings } from '@zardoy/vscode-utils/build/settings'
import { getExtensionSetting, Settings } from 'vscode-framework'
import { oneOf } from '@zardoy/utils'

export default (tsApi: { onCompletionAccepted }) => {
    let justAcceptedReturnKeywordSuggestion = false

    tsApi.onCompletionAccepted((item: vscode.CompletionItem & { document: vscode.TextDocument }) => {
        const enableMethodSnippets = vscode.workspace.getConfiguration(process.env.IDS_PREFIX, item.document).get('enableMethodSnippets')
        const { insertText, documentation = '', kind } = item
        if (kind === vscode.CompletionItemKind.Keyword && insertText === 'return ') {
            justAcceptedReturnKeywordSuggestion = true
        }

        const documentationString = documentation instanceof vscode.MarkdownString ? documentation.value : documentation
        const insertFuncArgs = /<!-- insert-func: (.*)-->/.exec(documentationString)?.[1]
        console.debug('insertFuncArgs', insertFuncArgs)
        if (enableMethodSnippets && insertFuncArgs !== undefined) {
            const editor = getActiveRegularEditor()!
            const startPos = editor.selection.start
            const nextSymbol = editor.document.getText(new vscode.Range(startPos, startPos.translate(0, 1)))
            if (!['(', '.'].includes(nextSymbol)) {
                const snippet = new vscode.SnippetString('')
                snippet.appendText('(')
                const args = insertFuncArgs.split(',')
                for (let [i, arg] of args.entries()) {
                    if (!arg) continue
                    // skip empty, but add tabstops if we explicitly want it!
                    if (arg === ' ') arg = ''
                    snippet.appendPlaceholder(arg)
                    if (i !== args.length - 1) snippet.appendText(', ')
                }

                snippet.appendText(')')
                void editor.insertSnippet(snippet, undefined, {
                    undoStopAfter: false,
                    undoStopBefore: false,
                })
                if (vscode.workspace.getConfiguration('editor.parameterHints').get('enabled')) {
                    void vscode.commands.executeCommand('editor.action.triggerParameterHints')
                }
            }
        }
    })

    conditionallyRegister(
        'suggestions.keywordsInsertText',
        () =>
            vscode.workspace.onDidChangeTextDocument(({ document, contentChanges, reason }) => {
                if (!justAcceptedReturnKeywordSuggestion) return
                if (document !== vscode.window.activeTextEditor?.document) return
                try {
                    if (oneOf(reason, vscode.TextDocumentChangeReason.Redo, vscode.TextDocumentChangeReason.Undo)) {
                        return
                    }

                    const char = contentChanges[0]?.text
                    if (char?.length !== 1 || contentChanges.some(({ text }) => text !== char)) {
                        return
                    }

                    if (char === ';') {
                        void vscode.window.activeTextEditor.edit(builder => {
                            for (const { range } of contentChanges) {
                                const pos = range.start
                                builder.delete(new vscode.Range(pos.translate(0, -1), pos))
                            }
                        })
                    }
                } finally {
                    justAcceptedReturnKeywordSuggestion = false
                }
            }),
        val => val !== 'none',
    )
}

const conditionallyRegister = <T extends keyof Settings>(
    settingKey: T,
    registerFn: () => vscode.Disposable,
    acceptSettingValue: (val: Settings[T]) => boolean = val => !!val,
) => {
    let disposable: vscode.Disposable | undefined
    const changeRegisterState = () => {
        const registerState = acceptSettingValue(getExtensionSetting(settingKey))
        if (registerState) {
            if (!disposable) disposable = registerFn()
        } else {
            disposable?.dispose()
            disposable = undefined
        }
    }

    changeRegisterState()
    watchExtensionSettings([settingKey], changeRegisterState)
}
