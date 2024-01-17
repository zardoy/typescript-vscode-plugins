import * as vscode from 'vscode'
import { defaultJsSupersetLangsWithVue } from '@zardoy/vscode-utils/build/langs'
import { registerExtensionCommand, showQuickPick, getExtensionSetting, getExtensionCommandId } from 'vscode-framework'
import { compact } from '@zardoy/utils'
import { RequestOutputTypes, RequestInputTypes } from '../typescript/src/ipcTypes'
import { sendCommand } from './sendCommand'
import { tsTextChangesToVscodeTextEdits, vscodeRangeToTs, tsTextChangesToVscodeSnippetTextEdits } from './util'

// extended and interactive code actions
export default () => {
    type ExtendedCodeAction = vscode.CodeAction & { document: vscode.TextDocument; requestRange: vscode.Range }

    // most probably will be moved to ts-code-actions extension
    vscode.languages.registerCodeActionsProvider(defaultJsSupersetLangsWithVue, {
        async provideCodeActions(document, range, context, token) {
            if (document !== vscode.window.activeTextEditor?.document || !getExtensionSetting('enablePlugin')) {
                return
            }

            const sourceActionKind = vscode.CodeActionKind.SourceFixAll.append('ts-essentials')
            if (context.only?.contains(vscode.CodeActionKind.SourceFixAll)) {
                if (
                    !context.only.contains(sourceActionKind) ||
                    (getExtensionSetting('removeCodeFixes.enable') && getExtensionSetting('removeCodeFixes.codefixes').includes('fixAllInFileSourceAction'))
                ) {
                    return
                }

                const fixAllEdits = await sendCommand('getFixAllEdits', {
                    document,
                })
                if (!fixAllEdits || token.isCancellationRequested) return
                const edit = new vscode.WorkspaceEdit()
                edit.set(document.uri, tsTextChangesToVscodeTextEdits(document, fixAllEdits))
                return [
                    {
                        title: '[TS essentials] Fix all',
                        kind: sourceActionKind,
                        edit,
                    },
                ]
            }

            if (context.triggerKind !== vscode.CodeActionTriggerKind.Invoke) return
            const result = await getPossibleTwoStepRefactorings(range, document, context.diagnostics)
            if (!result) return
            const { turnArrayIntoObject, extendedCodeActions } = result
            const codeActions: vscode.CodeAction[] = []
            const getCommand = (arg): vscode.Command | undefined => ({
                title: '',
                command: getExtensionCommandId('applyRefactor' as any),
                arguments: [arg],
            })

            if (turnArrayIntoObject) {
                codeActions.push({
                    title: `Turn array into object (${turnArrayIntoObject.totalCount} elements)`,
                    command: getCommand({ turnArrayIntoObject }),
                    kind: vscode.CodeActionKind.RefactorRewrite,
                })
            }

            codeActions.push(
                ...compact(
                    extendedCodeActions.map(({ title, kind, codes }): ExtendedCodeAction | undefined => {
                        let diagnostics: vscode.Diagnostic[] | undefined
                        if (codes) {
                            diagnostics = context.diagnostics.filter(({ source, code }) => {
                                if (source !== 'ts' || !code) return
                                const codeNumber = +(typeof code === 'object' ? code.value : code)
                                return codes.includes(codeNumber)
                            })
                            if (diagnostics.length === 0) return
                        }

                        return {
                            title,
                            diagnostics,
                            kind: vscode.CodeActionKind.Empty.append(kind),
                            requestRange: range,
                            document,
                        }
                    }),
                ),
            )

            return codeActions
        },
        async resolveCodeAction(codeAction: ExtendedCodeAction, token) {
            const { document } = codeAction
            if (!document) throw new Error('Unresolved code action without document')
            const result = await sendCommand('getExtendedCodeActionEdits', {
                document,
                inputOptions: {
                    applyCodeActionTitle: codeAction.title,
                    range: vscodeRangeToTs(document, codeAction.diagnostics?.length ? codeAction.diagnostics[0]!.range : codeAction.requestRange),
                },
            })
            if (!result) throw new Error('No code action edits. Try debug.')
            const { edits = [], snippetEdits = [] } = result
            const workspaceEdit = new vscode.WorkspaceEdit()
            workspaceEdit.set(document.uri, [
                ...tsTextChangesToVscodeTextEdits(document, edits),
                ...tsTextChangesToVscodeSnippetTextEdits(document, snippetEdits),
            ])
            codeAction.edit = workspaceEdit
            return codeAction
        },
    })

    registerExtensionCommand('applyRefactor' as any, async (_, arg?: RequestOutputTypes['getTwoStepCodeActions']) => {
        if (!arg) return
        let sendNextData: RequestInputTypes['twoStepCodeActionSecondStep']['data'] | undefined
        const { turnArrayIntoObject } = arg
        if (turnArrayIntoObject) {
            const { keysCount, totalCount, totalObjectCount } = turnArrayIntoObject
            const selectedKey = await showQuickPick(
                Object.entries(keysCount).map(([key, count]) => {
                    const isAllowed = count === totalObjectCount
                    return { label: `${isAllowed ? '$(check)' : '$(close)'}${key}`, value: isAllowed ? key : false, description: `${count} hits` }
                }),
                {
                    title: `Selected available key from ${totalObjectCount} objects (${totalCount} elements)`,
                },
            )
            if (selectedKey === undefined || selectedKey === '') return
            if (selectedKey === false) {
                void vscode.window.showWarningMessage("Can't use selected key as its not used in object of every element")
                return
            }

            sendNextData = {
                name: 'turnArrayIntoObject',
                selectedKeyName: selectedKey as string,
            }
        }

        if (!sendNextData) return
        const editor = vscode.window.activeTextEditor!
        const nextResponse = await getSecondStepRefactoringData(editor.selection, sendNextData)
        if (!nextResponse) throw new Error('No code action data. Try debug.')
        const edit = new vscode.WorkspaceEdit()
        const mainChanges = 'edits' in nextResponse && nextResponse.edits

        if (!mainChanges) return
        edit.set(editor.document.uri, tsTextChangesToVscodeTextEdits(editor.document, mainChanges))
        await vscode.workspace.applyEdit(edit)
    })

    async function getPossibleTwoStepRefactorings(range: vscode.Range, document: vscode.TextDocument, diagnostics: Readonly<vscode.Diagnostic[]>) {
        return sendCommand('getTwoStepCodeActions', {
            document,
            position: range.start,
            inputOptions: {
                range: vscodeRangeToTs(document, range),
                diagnostics: diagnostics.filter(({ source }) => source === 'ts').map(({ code }) => (typeof code === 'object' ? +code.value : +code!)),
            },
        })
    }

    async function getSecondStepRefactoringData(range: vscode.Range, secondStepData?: any, document = vscode.window.activeTextEditor!.document) {
        return sendCommand('twoStepCodeActionSecondStep', {
            document,
            position: range.start,
            inputOptions: {
                range: vscodeRangeToTs(document, range),
                data: secondStepData,
            },
        })
    }
}
