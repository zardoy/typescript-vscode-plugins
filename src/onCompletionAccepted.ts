import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { expandPosition } from '@zardoy/vscode-utils/build/position'
import { getExtensionSetting, registerExtensionCommand } from 'vscode-framework'
import { oneOf } from '@zardoy/utils'
import { RequestResponseTypes } from '../typescript/src/ipcTypes'
import { sendCommand } from './sendCommand'

export default (tsApi: { onCompletionAccepted }) => {
    let inFlightMethodSnippetOperation: undefined | AbortController
    let justAcceptedReturnKeywordSuggestion = false
    let onCompletionAcceptedOverride: ((item: any) => void) | undefined

    // eslint-disable-next-line complexity
    tsApi.onCompletionAccepted(async (item: vscode.CompletionItem & { document: vscode.TextDocument }) => {
        if (onCompletionAcceptedOverride) {
            onCompletionAcceptedOverride(item)
            return
        }

        const { label, insertText, kind } = item
        if (kind === vscode.CompletionItemKind.Keyword) {
            if (insertText === 'return ') justAcceptedReturnKeywordSuggestion = true
            else if (insertText === 'default ') void vscode.commands.executeCommand('editor.action.triggerSuggest')
            return
        }

        const isJsxAttributeStringCompletion = typeof insertText === 'object' && insertText.value.endsWith("='$1'")
        const isOurObjectLiteralCompletion =
            typeof insertText === 'object' && typeof label === 'object' && label.detail && [': [],', ': {},', ': "",', ": '',"].includes(label.detail)
        if (isJsxAttributeStringCompletion || isOurObjectLiteralCompletion) {
            // todo most probably should be controlled by quickSuggestions setting
            void vscode.commands.executeCommand('editor.action.triggerSuggest')
            return
        }

        const enableMethodSnippets = vscode.workspace.getConfiguration(process.env.IDS_PREFIX, item.document).get('enableMethodSnippets')

        if (enableMethodSnippets && /* snippet by vscode or by us to ignore pos */ typeof insertText !== 'object') {
            const editor = getActiveRegularEditor()!
            const startPos = editor.selection.start
            const nextSymbol = editor.document.getText(new vscode.Range(startPos, startPos.translate(0, 1)))
            if (!['(', '.', '`'].includes(nextSymbol)) {
                const controller = new AbortController()
                inFlightMethodSnippetOperation = controller
                const params: RequestResponseTypes['getFullMethodSnippet'] | undefined = await sendCommand('getFullMethodSnippet')
                if (!controller.signal.aborted && params) {
                    const replaceArguments = getExtensionSetting('methodSnippets.replaceArguments')

                    const snippet = new vscode.SnippetString('')
                    snippet.appendText('(')
                    // todo maybe when have optional (skipped), add a way to leave trailing , with tabstop (previous behavior)
                    for (const [i, param] of params.entries()) {
                        const replacer = replaceArguments[param.replace(/\?$/, '')]
                        if (replacer === null) continue
                        if (replacer) {
                            useReplacer(snippet, replacer)
                        } else {
                            snippet.appendPlaceholder(param)
                        }

                        if (i !== params.length - 1) snippet.appendText(', ')
                    }

                    snippet.appendText(')')
                    void editor.insertSnippet(snippet, undefined, {
                        undoStopAfter: false,
                        undoStopBefore: false,
                    })
                    if (vscode.workspace.getConfiguration('editor.parameterHints').get('enabled') && params.length > 0) {
                        void vscode.commands.executeCommand('editor.action.triggerParameterHints')
                    }
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

    vscode.workspace.onDidChangeTextDocument(({ document, contentChanges, reason }) => {
        if (document !== vscode.window.activeTextEditor?.document) return
        // do the same for position change?
        if (inFlightMethodSnippetOperation) {
            inFlightMethodSnippetOperation.abort()
            inFlightMethodSnippetOperation = undefined
        }

        if (!justAcceptedReturnKeywordSuggestion) return

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
    })
}

function useReplacer(snippet: vscode.SnippetString, replacer: string) {
    snippet.appendPlaceholder(inner => {
        // eslint-disable-next-line unicorn/no-array-for-each
        replacer.split(/(?<!\\)\$/g).forEach((text, i, arr) => {
            // inner.appendText(text.replace(/\\\$/g, '$'))
            inner.value += text
            if (i !== arr.length - 1) inner.appendTabstop()
        })
    })
}
