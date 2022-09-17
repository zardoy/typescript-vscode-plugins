import type tslib from 'typescript/lib/tsserverlibrary'
import postfixesAtPosition from '../completions/postfixesAtPosition'
import { TriggerCharacterCommand, triggerCharacterCommands } from '../ipcTypes'

export default (info: tslib.server.PluginCreateInfo, fileName: string, position: number, specialCommand: TriggerCharacterCommand, configuration: any) => {
    if (specialCommand === 'check-configuration') {
        return {
            entries: [],
            typescriptEssentialsResponse: !!configuration,
        }
    }
    if (triggerCharacterCommands.includes(specialCommand) && !configuration) {
        throw new Error('no-ts-essential-plugin-configuration')
    }
    if (specialCommand === 'getPostfixes') {
        const scriptSnapshot = info.project.getScriptSnapshot(fileName)
        if (!scriptSnapshot) return
        return {
            entries: [],
            typescriptEssentialsResponse: postfixesAtPosition(position, fileName, scriptSnapshot, info.languageService),
        } as any
    }
}
