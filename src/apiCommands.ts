import * as vscode from 'vscode'
import { getExtensionCommandId } from 'vscode-framework'
import { passthroughExposedApiCommands, TriggerCharacterCommand } from '../typescript/src/ipcTypes'
import { sendCommand } from './sendCommand'

export default () => {
    const sharedRequest = (type: TriggerCharacterCommand, { offset, relativeOffset = 0 }: RequestOptions) => {
        const { activeTextEditor } = vscode.window
        if (!activeTextEditor) return
        const { document, selection } = activeTextEditor
        offset ??= document.offsetAt(selection.active) + relativeOffset
        return sendCommand(type, { document, position: document.positionAt(offset) })
    }

    type RequestOptions = Partial<{
        offset: number
        relativeOffset: number
    }>
    for (const cmd of passthroughExposedApiCommands)
        vscode.commands.registerCommand(getExtensionCommandId(cmd as never), async (options: RequestOptions = {}) => sharedRequest(cmd, options))
}
