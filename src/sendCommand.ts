import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { getExtensionSetting } from 'vscode-framework'
import { passthroughExposedApiCommands, TriggerCharacterCommand } from '../typescript/src/ipcTypes'

type SendCommandData<K> = {
    position?: vscode.Position
    document?: vscode.TextDocument
    inputOptions?: K
}
export const sendCommand = async <Response, K = any>(
    command: TriggerCharacterCommand,
    sendCommandDataArg?: SendCommandData<K>,
): Promise<Response | undefined> => {
    // plugin id disabled, languageService would not understand the special trigger character
    if (!getExtensionSetting('enablePlugin')) {
        console.warn('Ignoring request because plugin is disabled')
        return
    }

    if (!vscode.extensions.getExtension('vscode.typescript-language-features')) {
        const message = 'Special commands are not supported in Volar takeover mode'
        if (passthroughExposedApiCommands.includes(command as any)) {
            // don't spam in case of api command
            console.error(message)
        } else {
            throw new Error(message)
        }

        return
    }

    const _editor = getActiveRegularEditor()!
    const { document: { uri } = _editor.document, position = _editor.selection.active, inputOptions } = sendCommandDataArg ?? {}

    if (inputOptions) {
        command = `${command}?${JSON.stringify(inputOptions)}` as any
    }

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
