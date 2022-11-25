import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { registerExtensionCommand } from 'vscode-framework'
import { showQuickPick } from '@zardoy/vscode-utils/build/quickPick'
import { RequestOptionsTypes, RequestResponseTypes } from '../typescript/src/ipcTypes'
import { sendCommand } from './sendCommand'
import { tsRangeToVscode } from './util'

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

    registerExtensionCommand('pickAndInsertFunctionArguments', async () => {
        const editor = getActiveRegularEditor()
        if (!editor) return
        const result = await sendCommand<RequestResponseTypes['pickAndInsertFunctionArguments']>('pickAndInsertFunctionArguments')
        if (!result) return
        const originalSelections = editor.selections

        const renderArgs = (args: Array<[name: string, type: string]>) => `${args.map(([name, type]) => (type ? `${name}: ${type}` : name)).join(', ')}`

        let revealBack = true
        const selectedFunction = await showQuickPick(
            result.functions.map(func => {
                const [name, _decl, args] = func
                return {
                    label: name,
                    value: func,
                    description: `(${renderArgs(args)})`,
                    buttons: [
                        {
                            iconPath: new vscode.ThemeIcon('go-to-file'),
                            tooltip: 'Go to declaration',
                        },
                    ],
                }
            }),
            {
                onDidTriggerItemButton(event) {
                    revealBack = false
                    this.hide()
                    const pos = editor.document.positionAt(event.item.value[1][0])
                    editor.selection = new vscode.Selection(pos, pos)
                    editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
                },
                onDidChangeFirstActive(item) {
                    const pos = editor.document.positionAt(item.value[1][0])
                    editor.selection = new vscode.Selection(pos, pos)
                    editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport)
                },
                onDidShow() {},
                matchOnDescription: true,
            },
        )
        if (revealBack) {
            editor.selections = originalSelections
            editor.revealRange(editor.selection)
        }

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
}
