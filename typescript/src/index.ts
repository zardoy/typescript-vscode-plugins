import get from 'lodash.get'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import type { Configuration } from '../../src/configurationType'
import _ from 'lodash'
import { GetConfig } from './types'
import { getCompletionsAtPosition, PrevCompletionMap } from './completionsAtPosition'
import { TriggerCharacterCommand } from './ipcTypes'
import { oneOf } from '@zardoy/utils'
import { isGoodPositionMethodCompletion } from './completions/isGoodPositionMethodCompletion'
import { getParameterListParts } from './completions/snippetForFunctionCall'
import { getNavTreeItems } from './getPatchedNavTree'
import { join } from 'path'
import decorateCodeActions from './codeActions/decorateProxy'
import decorateSemanticDiagnostics from './semanticDiagnostics'
import decorateCodeFixes from './codeFixes'
import decorateReferences from './references'
import handleSpecialCommand from './specialCommands/handle'

const thisPluginMarker = Symbol('__essentialPluginsMarker__')

// just to see wether issue is resolved
let _configuration: Configuration
const c: GetConfig = key => get(_configuration, key)
export = function ({ typescript }: { typescript: typeof import('typescript/lib/tsserverlibrary') }) {
    ts = typescript
    return {
        create(info: ts.server.PluginCreateInfo) {
            if (info.languageService[thisPluginMarker]) return info.languageService

            // Set up decorator object
            const proxy: ts.LanguageService = Object.create(null)

            for (const k of Object.keys(info.languageService)) {
                const x = info.languageService[k]!
                // @ts-expect-error - JS runtime trickery which is tricky to type tersely
                proxy[k] = (...args: Array<Record<string, unknown>>) => x.apply(info.languageService, args)
            }

            let prevCompletionsMap: PrevCompletionMap
            // eslint-disable-next-line complexity
            proxy.getCompletionsAtPosition = (fileName, position, options) => {
                const specialCommandResult = options?.triggerCharacter
                    ? handleSpecialCommand(info, fileName, position, options.triggerCharacter as TriggerCharacterCommand, _configuration)
                    : undefined
                // handled specialCommand request
                if (specialCommandResult !== undefined) return specialCommandResult
                prevCompletionsMap = {}
                const scriptSnapshot = info.project.getScriptSnapshot(fileName)
                // have no idea in which cases its possible, but we can't work without it
                if (!scriptSnapshot) return
                const result = getCompletionsAtPosition(fileName, position, options, c, info.languageService, scriptSnapshot, ts)
                if (!result) return
                prevCompletionsMap = result.prevCompletionsMap
                return result.completions
            }

            proxy.getCompletionEntryDetails = (fileName, position, entryName, formatOptions, source, preferences, data) => {
                const program = info.languageService.getProgram()
                const sourceFile = program?.getSourceFile(fileName)
                if (!program || !sourceFile) return
                const { documentationOverride } = prevCompletionsMap[entryName] ?? {}
                if (documentationOverride) {
                    return {
                        name: entryName,
                        kind: ts.ScriptElementKind.alias,
                        kindModifiers: '',
                        displayParts: typeof documentationOverride === 'string' ? [{ kind: 'text', text: documentationOverride }] : documentationOverride,
                    }
                }
                let prior = info.languageService.getCompletionEntryDetails(
                    fileName,
                    position,
                    prevCompletionsMap[entryName]?.originalName || entryName,
                    formatOptions,
                    source,
                    preferences,
                    data,
                )
                if (!prior) return
                if (
                    c('enableMethodSnippets') &&
                    oneOf(
                        prior.kind as string,
                        ts.ScriptElementKind.constElement,
                        ts.ScriptElementKind.letElement,
                        ts.ScriptElementKind.alias,
                        ts.ScriptElementKind.variableElement,
                        ts.ScriptElementKind.memberVariableElement,
                    )
                ) {
                    // - 1 to look for possibly previous completing item
                    let goodPosition = isGoodPositionMethodCompletion(ts, fileName, sourceFile, position - 1, info.languageService)
                    let rawPartsOverride: ts.SymbolDisplayPart[] | undefined
                    if (goodPosition && prior.kind === ts.ScriptElementKind.alias) {
                        goodPosition =
                            prior.displayParts[5]?.text === 'method' || (prior.displayParts[4]?.kind === 'keyword' && prior.displayParts[4].text === 'function')
                        const { parts, gotMethodHit, hasOptionalParameters } = getParameterListParts(prior.displayParts)
                        if (gotMethodHit) rawPartsOverride = hasOptionalParameters ? [...parts, { kind: '', text: ' ' }] : parts
                    }
                    const punctuationIndex = prior.displayParts.findIndex(({ kind, text }) => kind === 'punctuation' && text === ':')
                    if (goodPosition && punctuationIndex !== 1) {
                        const isParsableMethod = prior.displayParts
                            // next is space
                            .slice(punctuationIndex + 2)
                            .map(({ text }) => text)
                            .join('')
                            .match(/^\((.*)\) => /)
                        if (rawPartsOverride || isParsableMethod) {
                            let firstArgMeet = false
                            const args = (
                                rawPartsOverride ||
                                prior.displayParts.filter(({ kind }, index, array) => {
                                    if (kind !== 'parameterName') return false
                                    if (array[index - 1]!.text === '(') {
                                        if (!firstArgMeet) {
                                            // bad parsing, as it doesn't take second and more args
                                            firstArgMeet = true
                                            return true
                                        }
                                        return false
                                    }
                                    return true
                                })
                            ).map(({ text }) => text)
                            prior = {
                                ...prior,
                                documentation: [...(prior.documentation ?? []), { kind: 'text', text: `<!-- insert-func: ${args.join(',')}-->` }],
                            }
                        }
                    }
                }
                return prior
            }

            decorateCodeActions(proxy, info.languageService, c)
            decorateCodeFixes(proxy, info.languageService, c)
            decorateSemanticDiagnostics(proxy, info, c)
            decorateReferences(proxy, info.languageService, c)

            // dedicated syntax server (which is enabled by default), which fires navtree doesn't seem to receive onConfigurationChanged
            // so we forced to communicate via fs
            const config = JSON.parse(ts.sys.readFile(join(__dirname, '../../plugin-config.json'), 'utf8') ?? '{}')
            proxy.getNavigationTree = fileName => {
                if (c('patchOutline') || config.patchOutline) return getNavTreeItems(ts, info, fileName)
                return info.languageService.getNavigationTree(fileName)
            }

            info.languageService[thisPluginMarker] = true

            return proxy
        },
        onConfigurationChanged(config: any) {
            console.log('inspect config', JSON.stringify(config))
            _configuration = config
        },
    }
}
