import postfixesAtPosition from '../completions/postfixesAtPosition'
import { NodeAtPositionResponse, TriggerCharacterCommand, triggerCharacterCommands } from '../ipcTypes'
import { findChildContainingPosition } from '../utils'
import getEmmetCompletions from './emmet'

export default (
    info: ts.server.PluginCreateInfo,
    fileName: string,
    position: number,
    specialCommand: TriggerCharacterCommand,
    configuration: any,
): void | {
    entries: []
    typescriptEssentialsResponse: any
} => {
    if (triggerCharacterCommands.includes(specialCommand) && !configuration) {
        throw new Error('no-ts-essential-plugin-configuration')
    }
    const sourceFile = info.languageService.getProgram()!.getSourceFile(fileName)!
    if (specialCommand === 'emmet-completions') {
        const node = findChildContainingPosition(ts, sourceFile, position)
        if (!node) return
        return {
            entries: [],
            typescriptEssentialsResponse: getEmmetCompletions(fileName, node, sourceFile, position, info.languageService),
        }
    }
    if (specialCommand === 'nodeAtPosition') {
        const node = findChildContainingPosition(ts, sourceFile, position)
        return {
            entries: [],
            typescriptEssentialsResponse: !node
                ? undefined
                : ({
                      kindName: ts.SyntaxKind[node.kind],
                      start: node.getStart(),
                      end: node.getEnd(),
                  } as NodeAtPositionResponse),
        }
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
