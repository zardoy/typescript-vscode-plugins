import get from 'lodash.get'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import type { Configuration } from '../../src/configurationType'
import _ from 'lodash'
import { GetConfig } from './types'
import { getCompletionsAtPosition, PrevCompletionMap } from './completionsAtPosition'

const thisPluginMarker = Symbol('__essentialPluginsMarker__')

// just to see wether issue is resolved
let _configuration: Configuration
const c: GetConfig = key => get(_configuration, key)
export = function ({ typescript }: { typescript: typeof import('typescript/lib/tsserverlibrary') }) {
    const ts = typescript

    return {
        create(info: ts.server.PluginCreateInfo) {
            if (info.languageService[thisPluginMarker]) return info.languageService
            // const realGetSnapshot = info.languageServiceHost.getScriptSnapshot
            // info.languageServiceHost.getScriptSnapshot = fileName => {
            //     console.log('getSnapshot', fileName)
            //     return realGetSnapshot(fileName)
            // }
            // const realReadFile = info.serverHost.readFile
            // info.serverHost.readFile = fileName => {
            //     let contents = realReadFile(fileName)
            //     if (fileName.endsWith('/node_modules/typescript/lib/lib.dom.d.ts') && c('eventTypePatching.enable')) {
            //         contents = contents
            //             ?.replace('interface EventTarget {', 'interface EventTarget extends HTMLElement {')
            //             .replace('"change": Event;', '"change": Event & {currentTarget: HTMLInputElement, target: HTMLInputElement};')
            //             .replace('"change": Event;', '"change": Event & {currentTarget: HTMLInputElement, target: HTMLInputElement};')
            //             .replace('"input": Event;', '"input": Event & {currentTarget: HTMLInputElement, target: HTMLInputElement};')
            //     }
            //     return contents
            // }
            // const compilerOptions = typescript.convertCompilerOptionsFromJson(options.compilerOptions, options.sourcesRoot).options
            // console.log('getCompilationSettings', info.languageServiceHost.getCompilationSettings())
            // info.languageServiceHost.getScriptSnapshot
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
                prevCompletionsMap = {}
                if (!_configuration) console.log('no received configuration!')
                const scriptSnapshot = info.project.getScriptSnapshot(fileName)
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
                const prior = info.languageService.getCompletionEntryDetails(
                    fileName,
                    position,
                    prevCompletionsMap[entryName]?.originalName || entryName,
                    formatOptions,
                    source,
                    preferences,
                    data,
                )
                if (!prior) return
                // if (prior.kind === typescript.ScriptElementKind.constElement && prior.displayParts.map(item => item.text).join('').match(/: \(.+\) => .+/)) prior.codeActions?.push({
                //     description: '',
                //     changes: []
                // })
                // prior.codeActions = [{ description: '', changes: [{ fileName, textChanges: [{ span: { start: position, length: 0 }, newText: '()' }] }] }]
                // formatOptions
                // info.languageService.getDefinitionAtPosition(fileName, position)
                return prior
            }

            // proxy.getCombinedCodeFix(scope, fixId, formatOptions, preferences)
            proxy.getApplicableRefactors = (fileName, positionOrRange, preferences) => {
                let prior = info.languageService.getApplicableRefactors(fileName, positionOrRange, preferences)

                if (c('markTsCodeActions.enable')) prior = prior.map(item => ({ ...item, description: `🔵 ${item.description}` }))

                return prior
            }

            proxy.getCodeFixesAtPosition = (fileName, start, end, errorCodes, formatOptions, preferences) => {
                let prior = info.languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences)
                // const scriptSnapshot = info.project.getScriptSnapshot(fileName)
                const diagnostics = info.languageService.getSemanticDiagnostics(fileName)

                // https://github.com/Microsoft/TypeScript/blob/v4.5.5/src/compiler/diagnosticMessages.json#L458
                const appliableErrorCode = [1156, 1157].find(code => errorCodes.includes(code))
                if (appliableErrorCode) {
                    const diagnostic = diagnostics.find(({ code }) => code === appliableErrorCode)!
                    prior = [
                        ...prior,
                        {
                            fixName: 'wrapBlock',
                            description: 'Wrap in block',
                            changes: [
                                {
                                    fileName,
                                    textChanges: [
                                        { span: { start: diagnostic.start!, length: 0 }, newText: '{' },
                                        { span: { start: diagnostic.start! + diagnostic.length!, length: 0 }, newText: '}' },
                                    ],
                                },
                            ],
                        },
                    ]
                }

                if (c('removeCodeFixes.enable')) {
                    const toRemove = c('removeCodeFixes.codefixes')
                    prior = prior.filter(({ fixName }) => !toRemove.includes(fixName as any))
                }

                if (c('markTsCodeFixes.character'))
                    prior = prior.map(item => ({ ...item, description: `${c('markTsCodeFixes.character')} ${item.description}` }))

                return prior
            }

            proxy.findReferences = (fileName, position) => {
                let prior = info.languageService.findReferences(fileName, position)
                if (prior && c('removeDefinitionFromReferences')) {
                    prior = prior.map(({ references, ...other }) => ({ ...other, references: references.filter(({ isDefinition }) => !isDefinition) }))
                }
                return prior
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
