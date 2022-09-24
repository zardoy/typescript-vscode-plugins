import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { TriggerCharacterCommand } from '../typescript/src/ipcTypes'

type SendCommandData = {
    position: vscode.Position
    document: vscode.TextDocument
}
export const sendCommand = async <T>(command: TriggerCharacterCommand, sendCommandDataArg?: SendCommandData): Promise<T | undefined> => {
    const {
        document: { uri },
        position,
    } = ((): SendCommandData => {
        if (sendCommandDataArg) return sendCommandDataArg
        const editor = getActiveRegularEditor()!
        return {
            document: editor.document,
            position: editor.selection.active,
        }
    })()

    console.time(`request ${command}`)
    let requestFile = uri.fsPath
    if (uri.scheme !== 'file') requestFile = `^/${uri.scheme}/${uri.authority || 'ts-nul-authority'}/${uri.path.replace(/^\//, '')}`
    try {
        const result = (await vscode.commands.executeCommand('typescript.tsserverRequest', 'completionInfo', {
            _: '%%%',
            file: requestFile,
            line: position.line + 1,
            offset: position.character + 1,
            triggerCharacter: command,
        })) as any
        return result?.body?.typescriptEssentialsResponse
    } catch (err) {
        console.error(err)
    } finally {
        console.timeEnd(`request ${command}`)
    }

    return undefined
}
