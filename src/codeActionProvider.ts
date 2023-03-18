import * as vscode from 'vscode'
import { relative, join } from 'path-browserify'
import { defaultJsSupersetLangsWithVue } from '@zardoy/vscode-utils/build/langs'
import { partition } from 'lodash'
import { registerExtensionCommand, showQuickPick, getExtensionSetting, getExtensionCommandId } from 'vscode-framework'
import { compact } from '@zardoy/utils'
import { RequestResponseTypes, RequestOptionsTypes } from '../typescript/src/ipcTypes'
import { sendCommand } from './sendCommand'
import {
    pickFileWithQuickPick,
    getTsLikePath,
    tsRangeToVscode,
    tsTextChangesToVscodeTextEdits,
    vscodeRangeToTs,
    tsTextChangesToVscodeSnippetTextEdits,
} from './util'

// extended and interactive code actions
export default () => {
    type ExtendedCodeAction = vscode.CodeAction & { document: vscode.TextDocument; requestRange: vscode.Range }

    // most probably will be moved to ts-code-actions extension
    vscode.languages.registerCodeActionsProvider(defaultJsSupersetLangsWithVue, {
        async provideCodeActions(document, range, context, token) {
            if (document !== vscode.window.activeTextEditor?.document || !getExtensionSetting('enablePlugin')) {
                return
            }

            if (context.only?.contains(vscode.CodeActionKind.SourceFixAll)) {
                const fixAllEdits = await sendCommand<RequestResponseTypes['getFixAllEdits']>('getFixAllEdits', {
                    document,
                })
                if (!fixAllEdits || token.isCancellationRequested) return
                const edit = new vscode.WorkspaceEdit()
                edit.set(document.uri, tsTextChangesToVscodeTextEdits(document, fixAllEdits))
                return [
                    {
                        title: '[essentials] Fix all TypeScript',
                        kind: vscode.CodeActionKind.SourceFixAll,
                        edit,
                    },
                ]
            }

            if (context.triggerKind !== vscode.CodeActionTriggerKind.Invoke) return
            const result = await getPossibleTwoStepRefactorings(range)
            if (!result) return
            const { turnArrayIntoObject, moveToExistingFile, extendedCodeActions } = result
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

            if (moveToExistingFile) {
                // codeActions.push({
                //     title: `Move to existing file`,
                //     command: getCommand({ moveToExistingFile }),
                //     kind: vscode.CodeActionKind.Refactor.append('move'),
                // })
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
            const result = await sendCommand<RequestResponseTypes['getExtendedCodeActionEdits'], RequestOptionsTypes['getExtendedCodeActionEdits']>(
                'getExtendedCodeActionEdits',
                {
                    document,
                    inputOptions: {
                        applyCodeActionTitle: codeAction.title,
                        range: vscodeRangeToTs(document, codeAction.diagnostics?.length ? codeAction.diagnostics[0]!.range : codeAction.requestRange),
                    },
                },
            )
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

    registerExtensionCommand('applyRefactor' as any, async (_, arg?: RequestResponseTypes['getTwoStepCodeActions']) => {
        if (!arg) return
        let sendNextData: RequestOptionsTypes['twoStepCodeActionSecondStep']['data'] | undefined
        const { turnArrayIntoObject, moveToExistingFile } = arg
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

        if (moveToExistingFile) {
            sendNextData = {
                name: 'moveToExistingFile',
            }
        }

        if (!sendNextData) return
        const editor = vscode.window.activeTextEditor!
        const nextResponse = await getSecondStepRefactoringData(editor.selection, sendNextData)
        if (!nextResponse) throw new Error('No code action data. Try debug.')
        const edit = new vscode.WorkspaceEdit()
        let mainChanges = 'edits' in nextResponse && nextResponse.edits
        if (moveToExistingFile && 'fileNames' in nextResponse) {
            const { fileNames, fileEdits } = nextResponse
            const selectedFilePath = await pickFileWithQuickPick(fileNames)
            if (!selectedFilePath) return
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(selectedFilePath))
            // const outline = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri)

            const currentEditorPath = getTsLikePath(vscode.window.activeTextEditor!.document.uri)
            const currentFileEdits = [...fileEdits.find(fileEdit => fileEdit.fileName === currentEditorPath)!.textChanges]
            const textChangeIndexToPatch = currentFileEdits.findIndex(currentFileEdit => currentFileEdit.newText.trim())
            const { newText: updateImportText } = currentFileEdits[textChangeIndexToPatch]!
            // TODO-mid use native path resolver (ext, index, alias)
            let newRelativePath = relative(join(currentEditorPath, '..'), selectedFilePath)
            if (!newRelativePath.startsWith('./') && !newRelativePath.startsWith('../')) newRelativePath = `./${newRelativePath}`
            currentFileEdits[textChangeIndexToPatch]!.newText = updateImportText.replace(/(['"]).+(['"])/, (_m, g1) => `${g1}${newRelativePath}${g1}`)
            mainChanges = currentFileEdits
            const newFileText = fileEdits.find(fileEdit => fileEdit.isNewFile)!.textChanges[0]!.newText
            const [importLines, otherLines] = partition(newFileText.split('\n'), line => line.startsWith('import '))
            const startPos = new vscode.Position(0, 0)
            const newFileNodes = await sendCommand<RequestResponseTypes['filterBySyntaxKind']>('filterBySyntaxKind', {
                position: startPos,
                document,
            })
            const lastImportDeclaration = newFileNodes?.nodesByKind.ImportDeclaration?.at(-1)
            const lastImportEnd = lastImportDeclaration ? tsRangeToVscode(document, lastImportDeclaration.range).end : startPos
            edit.set(vscode.Uri.file(selectedFilePath), [
                {
                    range: new vscode.Range(startPos, startPos),
                    newText: [...importLines, '\n'].join('\n'),
                },
                {
                    range: new vscode.Range(lastImportEnd, lastImportEnd),
                    newText: ['\n', ...otherLines].join('\n'),
                },
            ])
        }

        if (!mainChanges) return
        edit.set(editor.document.uri, tsTextChangesToVscodeTextEdits(editor.document, mainChanges))
        await vscode.workspace.applyEdit(edit)
    })

    async function getPossibleTwoStepRefactorings(range: vscode.Range, document = vscode.window.activeTextEditor!.document) {
        return sendCommand<RequestResponseTypes['getTwoStepCodeActions'], RequestOptionsTypes['getTwoStepCodeActions']>('getTwoStepCodeActions', {
            document,
            position: range.start,
            inputOptions: {
                range: vscodeRangeToTs(document, range),
            },
        })
    }

    async function getSecondStepRefactoringData(range: vscode.Range, secondStepData?: any, document = vscode.window.activeTextEditor!.document) {
        return sendCommand<RequestResponseTypes['twoStepCodeActionSecondStep'], RequestOptionsTypes['twoStepCodeActionSecondStep']>(
            'twoStepCodeActionSecondStep',
            {
                document,
                position: range.start,
                inputOptions: {
                    range: vscodeRangeToTs(document, range),
                    data: secondStepData,
                },
            },
        )
    }
}
