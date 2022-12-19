import * as vscode from 'vscode'
import { getActiveRegularEditor, rangeToSelection } from '@zardoy/vscode-utils'
import { getExtensionCommandId, registerExtensionCommand, VSCodeQuickPickItem } from 'vscode-framework'
import { showQuickPick } from '@zardoy/vscode-utils/build/quickPick'
import _ from 'lodash'
import { compact } from '@zardoy/utils'
import { RequestOptionsTypes, RequestResponseTypes } from '../typescript/src/ipcTypes'
import { sendCommand } from './sendCommand'
import { tsRangeToVscode, tsRangeToVscodeSelection } from './util'

export default () => {
    registerExtensionCommand('removeFunctionArgumentsTypesInSelection', async () => {
        const editor = getActiveRegularEditor()
        if (!editor) return
        const { selection, document } = editor
        const response = await sendCommand<RequestResponseTypes['removeFunctionArgumentsTypesInSelection']>('removeFunctionArgumentsTypesInSelection', {
            document,
            position: selection.start,
            inputOptions: {
                endSelection: document.offsetAt(selection.end),
            } as RequestOptionsTypes['removeFunctionArgumentsTypesInSelection'],
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
}
