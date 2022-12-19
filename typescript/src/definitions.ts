import { join } from 'path'
import { GetConfig } from './types'
import { findChildContainingExactPosition } from './utils'

export default (proxy: ts.LanguageService, info: ts.server.PluginCreateInfo, c: GetConfig) => {
    proxy.getDefinitionAndBoundSpan = (fileName, position) => {
        const prior = info.languageService.getDefinitionAndBoundSpan(fileName, position)
        if (!prior) {
            if (c('enableFileDefinitions')) {
                const sourceFile = info.languageService.getProgram()!.getSourceFile(fileName)!
                const node = findChildContainingExactPosition(sourceFile, position)
                if (node && ts.isStringLiteral(node) && ['./', '../'].some(str => node.text.startsWith(str))) {
                    const file = join(fileName, '..', node.text)
                    if (info.languageServiceHost.fileExists?.(file)) {
                        const start = node.pos + node.getLeadingTriviaWidth() + 1 // + 1 for quote
                        const textSpan = {
                            start,
                            length: node.end - start - 1,
                        }
                        return {
                            textSpan,
                            definitions: [
                                {
                                    containerKind: undefined as any,
                                    containerName: '',
                                    name: '',
                                    fileName: file,
                                    textSpan: { start: 0, length: 0 },
                                    kind: ts.ScriptElementKind.moduleElement,
                                    contextSpan: { start: 0, length: 0 },
                                },
                            ],
                        }
                    }
                }
            }
            return
        }
        if (__WEB__) {
            // let extension handle it
            // TODO failedAliasResolution
            prior.definitions = prior.definitions?.filter(def => {
                return !def.unverified || def.fileName === fileName
            })
        }

        // used after check
        const firstDef = prior.definitions![0]!
        if (
            c('changeDtsFileDefinitionToJs') &&
            prior.definitions?.length === 1 &&
            // default, namespace import or import path click
            firstDef.containerName === '' &&
            firstDef.name.slice(1, -1) === firstDef.fileName.slice(0, -'.d.ts'.length) &&
            firstDef.fileName.endsWith('.d.ts')
        ) {
            const jsFileName = `${firstDef.fileName.slice(0, -'.d.ts'.length)}.js`
            const isJsFileExist = info.languageServiceHost.fileExists?.(jsFileName)
            if (isJsFileExist) prior.definitions = [{ ...firstDef, fileName: jsFileName }]
        }
        if (c('miscDefinitionImprovement') && prior.definitions?.length === 2) {
            prior.definitions = prior.definitions.filter(({ fileName, containerName }) => {
                const isFcDef = fileName.endsWith('node_modules/@types/react/index.d.ts') && containerName === 'FunctionComponent'
                return !isFcDef
            })
            // 11
        }

        if (
            c('removeModuleFileDefinitions') &&
            prior.definitions?.length === 1 &&
            firstDef.kind === ts.ScriptElementKind.moduleElement &&
            firstDef.name.slice(1, -1).startsWith('*.')
        ) {
            return
        }

        return prior
    }
}
