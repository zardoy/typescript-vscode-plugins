import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { getExtensionCommandId, getExtensionSetting, registerExtensionCommand, VSCodeQuickPickItem } from 'vscode-framework'
import { showQuickPick } from '@zardoy/vscode-utils/build/quickPick'
import _, { partition } from 'lodash'
import { compact } from '@zardoy/utils'
import { defaultJsSupersetLangsWithVue } from '@zardoy/vscode-utils/build/langs'
import { offsetPosition } from '@zardoy/vscode-utils/build/position'
import { relative, join } from 'path-browserify'
import { RequestOptionsTypes, RequestResponseTypes } from '../typescript/src/ipcTypes'
import { sendCommand } from './sendCommand'
import { getTsLikePath, pickFileWithQuickPick, tsRangeToVscode, tsRangeToVscodeSelection, tsTextChangesToVcodeTextEdits } from './util'

export default () => {
    registerExtensionCommand('removeFunctionArgumentsTypesInSelection', async () => {
        const editor = getActiveRegularEditor()
        if (!editor) return
        const { selection, document } = editor
        const response = await sendCommand<
            RequestResponseTypes['removeFunctionArgumentsTypesInSelection'],
            RequestOptionsTypes['removeFunctionArgumentsTypesInSelection']
        >('removeFunctionArgumentsTypesInSelection', {
            document,
            position: selection.start,
            inputOptions: {
                endSelection: document.offsetAt(selection.end),
            },
        })
        if (!response) return
        const { ranges } = response
        void editor.edit(builder => {
            for (const [start, end] of ranges) {
                builder.delete(new vscode.Range(document.positionAt(start), document.positionAt(end)))
            }
        })
    })

    const getCurrentValueRange = async () => {
        const editor = getActiveRegularEditor()
        if (!editor) return
        const result = await sendCommand<RequestResponseTypes['getRangeOfSpecialValue']>('getRangeOfSpecialValue')
        if (!result) return
        const range = tsRangeToVscode(editor.document, result.range)
        return range.with({ start: range.start.translate(0, / *{?/.exec(editor.document.lineAt(range.start).text.slice(range.start.character))![0]!.length) })
    }

    registerExtensionCommand('goToEndOfValue', async () => {
        const currentValueRange = await getCurrentValueRange()
        if (!currentValueRange) return
        const editor = getActiveRegularEditor()!
        editor.selection = new vscode.Selection(currentValueRange.end, currentValueRange.end)
    })
    registerExtensionCommand('goToStartOfValue', async () => {
        const currentValueRange = await getCurrentValueRange()
        if (!currentValueRange) return
        const editor = getActiveRegularEditor()!
        editor.selection = new vscode.Selection(currentValueRange.start, currentValueRange.start)
    })
    registerExtensionCommand('selectSpecialValue', async () => {
        const currentValueRange = await getCurrentValueRange()
        if (!currentValueRange) return
        const editor = getActiveRegularEditor()!
        editor.selection = new vscode.Selection(currentValueRange.start, currentValueRange.end)
    })

    const nodePicker = async <T>(data: T[], renderItem: (item: T) => Omit<VSCodeQuickPickItem, 'value'> & { nodeRange: [number, number] }) => {
        const editor = vscode.window.activeTextEditor!
        const originalSelections = editor.selections
        let revealBack = true

        // todo-p1 button to merge nodes with duplicated contents (e.g. same strings)
        const selected = await showQuickPick(
            data.map(item => {
                const custom = renderItem(item)
                return {
                    ...custom,
                    value: item,
                    buttons: [
                        {
                            iconPath: new vscode.ThemeIcon('go-to-file'),
                            tooltip: 'Go to declaration',
                            action: 'goToStartPos',
                        },
                        {
                            iconPath: new vscode.ThemeIcon('arrow-both'),
                            tooltip: 'Add to selection',
                            action: 'addSelection',
                        },
                    ],
                }
            }),
            {
                title: 'Select node...',
                onDidTriggerItemButton({ item, button }) {
                    const { action } = button as any
                    const sel = tsRangeToVscodeSelection(editor.document, (item as any).nodeRange)
                    revealBack = false
                    if (action === 'goToStartPos') {
                        editor.selection = new vscode.Selection(sel.start, sel.start)
                        editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
                        this.hide()
                    } else {
                        editor.selections = [...editor.selections, sel]
                    }
                },
                onDidChangeFirstActive(item) {
                    const pos = editor.document.positionAt((item as any).nodeRange[0])
                    editor.selection = new vscode.Selection(pos, pos)
                    editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
                },
                matchOnDescription: true,
            },
        )
        if (revealBack) {
            editor.selections = originalSelections
            editor.revealRange(editor.selection)
        }

        return selected
    }

    registerExtensionCommand('pickAndInsertFunctionArguments', async () => {
        const editor = getActiveRegularEditor()
        if (!editor) return
        const result = await sendCommand<RequestResponseTypes['pickAndInsertFunctionArguments']>('pickAndInsertFunctionArguments')
        if (!result) return

        const renderArgs = (args: Array<[name: string, type: string]>) => `${args.map(([name, type]) => (type ? `${name}: ${type}` : name)).join(', ')}`

        const selectedFunction = await nodePicker(result.functions, ([name, decl, args]) => ({
            label: name,
            description: `(${renderArgs(args)})`,
            nodeRange: decl,
        }))

        if (!selectedFunction) return
        const selectedArgs = await showQuickPick(
            selectedFunction[2].map(arg => {
                const [name, type] = arg
                return {
                    label: name,
                    description: type,
                    value: arg,
                }
            }),
            {
                title: `Select args to insert of ${selectedFunction[0]}`,
                canPickMany: true,
                initialAllSelected: true,
                // onDidShow() {
                //     this.buttons = [{
                //         iconPath:
                //     }]
                // },
            },
        )
        if (!selectedArgs) return
        void editor.edit(edit => {
            for (const selection of editor.selections) {
                edit.replace(selection, renderArgs(selectedArgs))
            }
        })
    })

    registerExtensionCommand('goToNodeBySyntaxKind', async (_arg, { filterWithSelection = false }: { filterWithSelection?: boolean } = {}) => {
        const editor = vscode.window.activeTextEditor
        if (!editor) return
        const { document } = editor
        const result = await sendCommand<RequestResponseTypes['filterBySyntaxKind']>('filterBySyntaxKind')
        if (!result) return
        // todo optimize
        if (filterWithSelection) {
            result.nodesByKind = Object.fromEntries(
                compact(
                    Object.entries(result.nodesByKind).map(([kind, nodes]) => {
                        const filteredNodes = nodes.filter(({ range: tsRange }) =>
                            editor.selections.some(sel => sel.contains(tsRangeToVscode(document, tsRange))),
                        )
                        if (filteredNodes.length === 0) return
                        return [kind, filteredNodes]
                    }),
                ),
            )
        }

        const selectedKindNodes = await showQuickPick(
            _.sortBy(Object.entries(result.nodesByKind), ([, nodes]) => nodes.length)
                .reverse()
                .map(([kind, nodes]) => ({
                    label: kind,
                    description: nodes.length.toString(),
                    value: nodes,
                    buttons: [
                        {
                            iconPath: new vscode.ThemeIcon('arrow-both'),
                            tooltip: 'Select all nodes of this kind',
                        },
                    ],
                })),
            {
                onDidTriggerItemButton(button) {
                    editor.selections = button.item.value.map(({ range }) => tsRangeToVscodeSelection(document, range))
                    this.hide()
                },
            },
        )
        if (!selectedKindNodes) return
        const selectedNode = await nodePicker(selectedKindNodes, node => ({
            label: document
                .getText(tsRangeToVscode(document, node.range))
                .trim()
                .replace(/\r?\n\s+/g, ' '),
            nodeRange: node.range,
            value: node,
        }))
        if (!selectedNode) return
        editor.selection = tsRangeToVscodeSelection(document, selectedNode.range)
        editor.revealRange(editor.selection)
    })

    registerExtensionCommand('goToNodeBySyntaxKindWithinSelection', async () => {
        await vscode.commands.executeCommand(getExtensionCommandId('goToNodeBySyntaxKind'), { filterWithSelection: true })
    })

    async function getPossibleTwoStepRefactorings(range: vscode.Range, document = vscode.window.activeTextEditor!.document) {
        return sendCommand<RequestResponseTypes['getTwoStepCodeActions'], RequestOptionsTypes['getTwoStepCodeActions']>('getTwoStepCodeActions', {
            document,
            position: range.start,
            inputOptions: {
                range: [document.offsetAt(range.start), document.offsetAt(range.end)] as [number, number],
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
                    range: [document.offsetAt(range.start), document.offsetAt(range.end)] as [number, number],
                    data: secondStepData,
                },
            },
        )
    }

    registerExtensionCommand('acceptRenameWithParams' as any, async (_, { preview = false, comments = null, strings = null, alias = null } = {}) => {
        const editor = vscode.window.activeTextEditor
        if (!editor) return
        const {
            document,
            selection: { active: position },
        } = editor
        await sendCommand<RequestOptionsTypes['acceptRenameWithParams']>('acceptRenameWithParams', {
            document,
            position,
            inputOptions: {
                alias,
                comments,
                strings,
            } satisfies RequestOptionsTypes['acceptRenameWithParams'],
        })
        await vscode.commands.executeCommand(preview ? 'acceptRenameInputWithPreview' : 'acceptRenameInput')
    })

    // #region two-steps code actions
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
        edit.set(editor.document.uri, tsTextChangesToVcodeTextEdits(editor.document, mainChanges))
        await vscode.workspace.applyEdit(edit)
    })

    // most probably will be moved to ts-code-actions extension
    vscode.languages.registerCodeActionsProvider(defaultJsSupersetLangsWithVue, {
        async provideCodeActions(document, range, context, token) {
            if (document !== vscode.window.activeTextEditor?.document || !getExtensionSetting('enablePlugin')) {
                return
            }

            if (context.only?.contains(vscode.CodeActionKind.SourceFixAll)) {
                const fixAllEdits = await sendCommand<RequestResponseTypes['getFixAllEdits']>('getFixAllEdits')
                if (!fixAllEdits) return
                const edit = new vscode.WorkspaceEdit()
                edit.set(document.uri, tsTextChangesToVcodeTextEdits(document, fixAllEdits))
                await vscode.workspace.applyEdit(edit)
                return
            }

            if (context.triggerKind !== vscode.CodeActionTriggerKind.Invoke) return
            const result = await getPossibleTwoStepRefactorings(range)
            if (!result) return
            const { turnArrayIntoObject, moveToExistingFile } = result
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

            return codeActions
        },
    })
    // #endregion
}
