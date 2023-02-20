import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { conditionallyRegister } from '@zardoy/vscode-utils/build/settings'
import { expandPosition } from '@zardoy/vscode-utils/build/position'
import { getExtensionSetting, registerExtensionCommand } from 'vscode-framework'
import { oneOf } from '@zardoy/utils'
import { RequestOptionsTypes, RequestResponseTypes } from '../typescript/src/ipcTypes'
import { sendCommand } from './sendCommand'

export default (tsApi: { onCompletionAccepted }) => {
    let justAcceptedReturnKeywordSuggestion = false
    let onCompletionAcceptedOverride: ((item: any) => void) | undefined

    // eslint-disable-next-line complexity
    tsApi.onCompletionAccepted(async (item: vscode.CompletionItem & { document: vscode.TextDocument }) => {
        if (onCompletionAcceptedOverride) {
            onCompletionAcceptedOverride(item)
            return
        }

        const { label, insertText, documentation = '', kind } = item
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

        if (enableMethodSnippets && /* either snippet by vscode or by us to ignore pos */ typeof insertText !== 'object') {
            const editor = getActiveRegularEditor()!
            const startPos = editor.selection.start
            const nextSymbol = editor.document.getText(new vscode.Range(startPos, startPos.translate(0, 1)))
            if (!['(', '.'].includes(nextSymbol)) {
                const insertMode = getExtensionSetting('methodSnippets.insertText')
                const skipMode = getExtensionSetting('methodSnippets.skip')
                const data: RequestResponseTypes['getSignatureInfo'] | undefined = await sendCommand('getSignatureInfo', {
                    inputOptions: {
                        includeInitializer: insertMode === 'always-declaration',
                    } satisfies RequestOptionsTypes['getSignatureInfo'],
                })
                if (data) {
                    const parameters = data.parameters.filter(({ insertText, isOptional }) => {
                        const isRest = insertText.startsWith('...')
                        if (skipMode === 'only-rest' && isRest) return false
                        if (skipMode === 'optional-and-rest' && isOptional) return false
                        return true
                    })

                    const snippet = new vscode.SnippetString('')
                    snippet.appendText('(')
                    // todo maybe when have skipped, add a way to leave trailing , (previous behavior)
                    for (const [i, { insertText, name }] of parameters.entries()) {
                        const isRest = insertText.startsWith('...')
                        let text: string
                        // eslint-disable-next-line default-case
                        switch (insertMode) {
                            case 'always-name':
                                text = name
                                break
                            case 'prefer-name':
                                // prefer name, but only if identifier and not binding pattern & rest
                                text = oneOf(insertText[0], '[', '{') ? insertText : isRest ? insertText : name
                                break
                            case 'always-declaration':
                                text = insertText
                                break
                        }

                        snippet.appendPlaceholder(text)
                        if (i !== parameters.length - 1) snippet.appendText(', ')
                    }

                    const allFiltered = data.parameters.length > parameters.length
                    // TODO when many, but at least one not empty
                    if (allFiltered || data.hasManySignatures) snippet.appendTabstop()

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
