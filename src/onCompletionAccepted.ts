import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { conditionallyRegister } from '@zardoy/vscode-utils/build/settings'
import { expandPosition } from '@zardoy/vscode-utils/build/position'
import { getExtensionSetting, registerExtensionCommand } from 'vscode-framework'
import { oneOf } from '@zardoy/utils'

export default (tsApi: { onCompletionAccepted }) => {
    let justAcceptedReturnKeywordSuggestion = false
    let onCompletionAcceptedOverride: ((item: any) => void) | undefined

    tsApi.onCompletionAccepted((item: vscode.CompletionItem & { document: vscode.TextDocument }) => {
        if (onCompletionAcceptedOverride) {
            onCompletionAcceptedOverride(item)
            return
        }

        const { insertText, documentation = '', kind } = item
        if (kind === vscode.CompletionItemKind.Keyword) {
            if (insertText === 'return ') justAcceptedReturnKeywordSuggestion = true
            else if (insertText === 'default ') void vscode.commands.executeCommand('editor.action.triggerSuggest')
        }

        const enableMethodSnippets = vscode.workspace.getConfiguration(process.env.IDS_PREFIX, item.document).get('enableMethodSnippets')
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

    registerExtensionCommand('inspectAcceptedCompletion', async () => {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Waiting for completion to be accepted',
                cancellable: true,
            },
            async (_progress, token) => {
                const accepted = await new Promise<boolean>(resolve => {
                    token.onCancellationRequested(() => {
                        onCompletionAcceptedOverride = undefined
                        resolve(false)
                    })
                    onCompletionAcceptedOverride = item => {
                        console.dir(item, { depth: 4 })
                        resolve(true)
                    }
                })
                if (accepted) void vscode.window.showInformationMessage('Completion accepted, see console for details')
            },
        )
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

                    if (char === ';' || char === '\n') {
                        void vscode.window.activeTextEditor.edit(
                            builder => {
                                for (const { range } of contentChanges) {
                                    const pos = range.start
                                    builder.delete(expandPosition(document, pos, -1))
                                }
                            },
                            {
                                undoStopAfter: false,
                                undoStopBefore: false,
                            },
                        )
                    }
                } finally {
                    justAcceptedReturnKeywordSuggestion = false
                }
            }),
        () => getExtensionSetting('suggestions.keywordsInsertText') !== 'none',
    )
}
