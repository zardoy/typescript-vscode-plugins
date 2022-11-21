import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { registerExtensionCommand } from 'vscode-framework'
import { RequestOptionsTypes, RequestResponseTypes } from '../typescript/src/ipcTypes'
import { sendCommand } from './sendCommand'

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

    registerExtensionCommand('pickAndInsertFunctionArguments', async () => {
        const editor = getActiveRegularEditor()
        if (!editor) return
        const result = await sendCommand<RequestResponseTypes['pickAndInsertFunctionArguments']>('pickAndInsertFunctionArguments')
        if (!result) return
        result.functions
    })
}
