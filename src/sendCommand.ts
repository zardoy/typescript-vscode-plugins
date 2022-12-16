import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { getExtensionSetting } from 'vscode-framework'
import { TriggerCharacterCommand } from '../typescript/src/ipcTypes'

type SendCommandData<K> = {
    position: vscode.Position
    document: vscode.TextDocument
    inputOptions?: K
}
export const sendCommand = async <T, K = any>(command: TriggerCharacterCommand, sendCommandDataArg?: SendCommandData<K>): Promise<T | undefined> => {
    // plugin id disabled, languageService would not understand the special trigger character
    if (!getExtensionSetting('enablePlugin')) return

    if (sendCommandDataArg?.inputOptions) {
        command = `${command}?${JSON.stringify(sendCommandDataArg.inputOptions)}` as any
    }

    const {
        document: { uri },
        position,
    } = ((): SendCommandData<any> => {
        if (sendCommandDataArg) return sendCommandDataArg
        const editor = getActiveRegularEditor()!
        return {
            document: editor.document,
            position: editor.selection.active,
        }
    })()

    if (process.env.NODE_ENV === 'development') console.time(`request ${command}`)
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
        if (process.env.NODE_ENV === 'development') console.timeEnd(`request ${command}`)
    }

    return undefined
}
