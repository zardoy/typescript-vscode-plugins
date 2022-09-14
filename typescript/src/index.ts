import get from 'lodash.get'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import type { Configuration } from '../../src/configurationType'
import _ from 'lodash'
import { GetConfig } from './types'
import { getCompletionsAtPosition, PrevCompletionMap } from './completionsAtPosition'
import { oneOf } from '@zardoy/utils'
import { isGoodPositionMethodCompletion } from './isGoodPositionMethodCompletion'
import { inspect } from 'util'
import { getParameterListParts } from './snippetForFunctionCall'

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
                    oneOf(prior.kind as string, ts.ScriptElementKind.constElement, ts.ScriptElementKind.letElement, ts.ScriptElementKind.alias, 'property')
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
                    const punctuationIndex = prior.displayParts.findIndex(({ kind }) => kind === 'punctuation')
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
                // if (prior.kind === typescript.ScriptElementKind.constElement && prior.displayParts.map(item => item.text).join('').match(/: \(.+\) => .+/)) prior.codeActions?.push({
                //     description: '',
                //     changes: []
                // })
                return prior
            }

            proxy.getApplicableRefactors = (fileName, positionOrRange, preferences) => {
                let prior = info.languageService.getApplicableRefactors(fileName, positionOrRange, preferences)

                if (c('markTsCodeActions.enable')) prior = prior.map(item => ({ ...item, description: `🔵 ${item.description}` }))

                return prior
            }

            proxy.getCodeFixesAtPosition = (fileName, start, end, errorCodes, formatOptions, preferences) => {
                let prior = info.languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences)
                // fix builtin codefixes/refactorings
                prior.forEach(fix => {
                    if (fix.fixName === 'fixConvertConstToLet') {
                        const { start, length } = fix.changes[0]!.textChanges[0]!.span
                        const fixedLength = 'const'.length as 5
                        fix.changes[0]!.textChanges[0]!.span.start = start + length - fixedLength
                        fix.changes[0]!.textChanges[0]!.span.length = fixedLength
                    }
                    return fix
                })
                // const scriptSnapshot = info.project.getScriptSnapshot(fileName)
                const diagnostics = proxy.getSemanticDiagnostics(fileName)

                // https://github.com/Microsoft/TypeScript/blob/v4.5.5/src/compiler/diagnosticMessages.json#L458
                const appliableErrorCode = [1156, 1157].find(code => errorCodes.includes(code))
                if (appliableErrorCode) {
                    const program = info.languageService.getProgram()
                    const sourceFile = program!.getSourceFile(fileName)!
                    const startIndent = getIndentFromPos(typescript, sourceFile, end)
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
                                        { span: { start: diagnostic.start!, length: 0 }, newText: `{\n${startIndent}\t` },
                                        { span: { start: diagnostic.start! + diagnostic.length!, length: 0 }, newText: `\n${startIndent}}` },
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

            proxy.getDefinitionAndBoundSpan = (fileName, position) => {
                const prior = info.languageService.getDefinitionAndBoundSpan(fileName, position)
                if (!prior) return
                // used after check
                const firstDef = prior.definitions![0]!
                if (
                    c('changeDtsFileDefinitionToJs') &&
                    prior.definitions?.length === 1 &&
                    // default, namespace import or import path click
                    firstDef.containerName === '' &&
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
                }
                return prior
            }

            proxy.findReferences = (fileName, position) => {
                let prior = info.languageService.findReferences(fileName, position)
                if (!prior) return
                if (c('removeDefinitionFromReferences')) {
                    prior = prior.map(({ references, ...other }) => ({
                        ...other,
                        references: references.filter(({ isDefinition }) => !isDefinition),
                    }))
                }
                return prior
            }

            proxy.getSemanticDiagnostics = fileName => {
                let prior = info.languageService.getSemanticDiagnostics(fileName)
                if (c('supportTsDiagnosticDisableComment')) {
                    const scriptSnapshot = info.project.getScriptSnapshot(fileName)!
                    const firstLine = scriptSnapshot.getText(0, scriptSnapshot.getLength()).split(/\r?\n/)[0]!
                    if (firstLine.startsWith('//')) {
                        const match = firstLine.match(/@ts-diagnostic-disable ((\d+, )*(\d+))/)
                        if (match) {
                            const codesToDisable = match[1]!.split(', ').map(Number)
                            prior = prior.filter(({ code }) => !codesToDisable.includes(code))
                        }
                    }
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
