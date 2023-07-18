import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { expandPosition } from '@zardoy/vscode-utils/build/position'
import { getExtensionSetting, registerExtensionCommand } from 'vscode-framework'
import { oneOf } from '@zardoy/utils'

export const onCompletionAcceptedOverride: { value: ((item: any) => void) | undefined } = { value: undefined }

export default (tsApi: { onCompletionAccepted }) => {
    let inFlightMethodSnippetOperation: undefined | AbortController
    let justAcceptedReturnKeywordSuggestion = false
    let lastAcceptedAmbiguousMethodSnippetSuggestion: string | undefined

    // eslint-disable-next-line complexity
    tsApi.onCompletionAccepted(async (item: vscode.CompletionItem & { document: vscode.TextDocument; tsEntry }) => {
        if (onCompletionAcceptedOverride.value) {
            onCompletionAcceptedOverride.value(item)
            onCompletionAcceptedOverride.value = undefined
            return
        }

        const { label, insertText, kind } = item
        const suggestionName = typeof label === 'object' ? label.label : label
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

        if (/* snippet is by vscode or by us to ignore pos */ typeof insertText !== 'object') {
            const editor = getActiveRegularEditor()!

            const documentation = typeof item.documentation === 'object' ? item.documentation.value : item.documentation
            const dataMarker = '<!--tep '
            if (!documentation?.startsWith(dataMarker)) return
            const parsed = JSON.parse(documentation.slice(dataMarker.length, documentation.indexOf('e-->')))
            const { methodSnippet: params, isAmbiguous, wordStartOffset } = parsed
            const startPos = editor.selection.start
            const acceptedWordStartOffset = wordStartOffset !== undefined && editor.document.getWordRangeAtPosition(startPos, /[\w\d]+/i)?.start
            if (!oneOf(acceptedWordStartOffset, false, undefined) && wordStartOffset === editor.document.offsetAt(acceptedWordStartOffset)) {
                await new Promise<void>(resolve => {
                    vscode.workspace.onDidChangeTextDocument(({ document, contentChanges }) => {
                        if (document !== editor.document || contentChanges.length === 0) return
                        resolve()
                    })
                })
                await new Promise(resolve => {
                    setTimeout(resolve, 0)
                })
            }

            // nextChar check also duplicated in completionEntryDetails for perf, but we need to run this check again with correct position
            const nextChar = editor.document.getText(new vscode.Range(startPos, startPos.translate(0, 1)))
            if (!params || ['(', '.', '`'].includes(nextChar)) return

            if (getExtensionSetting('methodSnippetsInsertText') === 'disable') {
                // handle insertion only if it wasn't handled by methodSnippetsInsertText already
                if (isAmbiguous && lastAcceptedAmbiguousMethodSnippetSuggestion !== suggestionName) {
                    lastAcceptedAmbiguousMethodSnippetSuggestion = suggestionName
                    return
                }

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
            }
            if (vscode.workspace.getConfiguration('editor.parameterHints').get('enabled') && params.length > 0) {
                void vscode.commands.executeCommand('editor.action.triggerParameterHints')
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
                        resolve(false)
                    })
                    onCompletionAcceptedOverride.value = item => {
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

    vscode.window.onDidChangeTextEditorSelection(({ textEditor }) => {
        if (textEditor !== vscode.window.activeTextEditor) return
        // cursor position changed
        lastAcceptedAmbiguousMethodSnippetSuggestion = undefined
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
