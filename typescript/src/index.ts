import get from 'lodash.get'
import type tslib from 'typescript/lib/tsserverlibrary'
import * as emmet from '@vscode/emmet-helper'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import type { Configuration } from '../../src/configurationType'

export = function ({ typescript }: { typescript: typeof import('typescript/lib/tsserverlibrary') }) {
    const ts = typescript
    let _configuration: Configuration
    const c = <T extends keyof Configuration>(key: T): Configuration[T] => get(_configuration, key)

    return {
        create(info: ts.server.PluginCreateInfo) {
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

            let prevCompletionsMap: Record<string, { originalName: string }>
            // eslint-disable-next-line complexity
            proxy.getCompletionsAtPosition = (fileName, position, options) => {
                prevCompletionsMap = {}
                if (!_configuration) console.log('no received configuration!')

                // console.time('slow-down')
                const program = info.languageService.getProgram()
                const sourceFile = program?.getSourceFile(fileName)
                if (!program || !sourceFile) return
                const scriptSnapshot = info.project.getScriptSnapshot(fileName)
                const { line, character } = info.languageService.toLineColumnOffset!(fileName, position)
                if (!scriptSnapshot) return
                let prior = info.languageService.getCompletionsAtPosition(fileName, position, options)
                // console.log(
                //     'raw prior',
                //     prior?.entries.map(entry => entry.name),
                // )
                if (['.jsx', '.tsx'].some(ext => fileName.endsWith(ext))) {
                    // JSX Features
                    const node = findChildContainingPosition(typescript, sourceFile, position)
                    if (node) {
                        const { SyntaxKind } = ts
                        const emmetSyntaxKinds = [SyntaxKind.JsxFragment, SyntaxKind.JsxElement, SyntaxKind.JsxText]
                        const emmetClosingSyntaxKinds = [SyntaxKind.JsxClosingElement, SyntaxKind.JsxClosingFragment]
                        // TODO maybe allow fragment?
                        const correntComponentSuggestionsKinds = [SyntaxKind.JsxOpeningElement, SyntaxKind.JsxSelfClosingElement]
                        const nodeText = node.getFullText().slice(0, position - node.pos)
                        if (
                            correntComponentSuggestionsKinds.includes(node.kind) &&
                            c('jsxImproveElementsSuggestions.enabled') &&
                            !nodeText.includes(' ') &&
                            prior
                        ) {
                            let lastPart = nodeText.split('.').at(-1)!
                            if (lastPart.startsWith('<')) lastPart = lastPart.slice(1)
                            const isStartingWithUpperCase = (str: string) => str[0] === str[0]?.toUpperCase()
                            // check if starts with lowercase
                            if (isStartingWithUpperCase(lastPart))
                                // TODO! compare with suggestions from lib.dom
                                prior.entries = prior.entries.filter(
                                    entry => isStartingWithUpperCase(entry.name) && ![typescript.ScriptElementKind.enumElement].includes(entry.kind),
                                )
                        }

                        if (
                            c('jsxEmmet.type') !== 'disabled' &&
                            (emmetSyntaxKinds.includes(node.kind) ||
                                /* Just before closing tag */ (emmetClosingSyntaxKinds.includes(node.kind) && nodeText.length === 0))
                        ) {
                            // const { textSpan } = proxy.getSmartSelectionRange(fileName, position)
                            // let existing = scriptSnapshot.getText(textSpan.start, textSpan.start + textSpan.length)
                            // if (existing.includes('\n')) existing = ''
                            if (!prior) prior = { entries: [], isGlobalCompletion: false, isMemberCompletion: false, isNewIdentifierLocation: false }
                            // if (existing.startsWith('.')) {
                            //     const className = existing.slice(1)
                            //     prior.entries.push({
                            //         kind: typescript.ScriptElementKind.label,
                            //         name: className,
                            //         sortText: '!5',
                            //         insertText: `<div className="${className}">$1</div>`,
                            //         isSnippet: true,
                            //     })
                            // } else if (!existing[0] || existing[0].match(/\w/)) {
                            if (c('jsxEmmet.type') === 'realEmmet') {
                                const sendToEmmet = nodeText.split(' ').at(-1)!
                                const emmetCompletions = emmet.doComplete(
                                    {
                                        getText: () => sendToEmmet,
                                        languageId: 'html',
                                        lineCount: 1,
                                        offsetAt: position => position.character,
                                        positionAt: offset => ({ line: 0, character: offset }),
                                        uri: '/',
                                        version: 1,
                                    },
                                    { line: 0, character: sendToEmmet.length },
                                    'html',
                                    {},
                                ) ?? { items: [] }
                                for (const completion of emmetCompletions.items)
                                    prior.entries.push({
                                        kind: typescript.ScriptElementKind.label,
                                        name: completion.label.slice(1),
                                        sortText: '!5',
                                        // insertText: `${completion.label.slice(1)} ${completion.textEdit?.newText}`,
                                        insertText: completion.textEdit?.newText,
                                        isSnippet: true,
                                        sourceDisplay: completion.detail !== undefined ? [{ kind: 'text', text: completion.detail }] : undefined,
                                        // replacementSpan: { start: position - 5, length: 5 },
                                    })
                            } else {
                                const tags = c('jsxPseudoEmmet.tags')
                                for (let [tag, value] of Object.entries(tags)) {
                                    if (value === true) value = `<${tag}>$1</${tag}>`
                                    prior.entries.push({
                                        kind: typescript.ScriptElementKind.label,
                                        name: tag,
                                        sortText: '!5',
                                        insertText: value,
                                        isSnippet: true,
                                    })
                                }
                            }
                        }
                    }
                }

                if (!prior) return

                // const fullText = scriptSnapshot.getText(0, scriptSnapshot.getLength())
                // const matchImport = /(import (.*)from )['"].*['"]/.exec(fullText.split('\n')[line]!)?.[1]
                // if (matchImport && character <= `import${matchImport}`.length) {
                //     console.log('override')
                //     return
                // }
                // prior.isGlobalCompletion
                // prior.entries[0]
                const entryNames = new Set(prior.entries.map(({ name }) => name))
                if (c('removeUselessFunctionProps.enable')) prior.entries = prior.entries.filter(e => !['Symbol', 'caller', 'prototype'].includes(e.name))
                if (['bind', 'call', 'caller'].every(name => entryNames.has(name)) && c('highlightNonFunctionMethods.enable')) {
                    const standardProps = new Set(['Symbol', 'apply', 'arguments', 'bind', 'call', 'caller', 'length', 'name', 'prototype', 'toString'])
                    // TODO lift up!
                    prior.entries = prior.entries.map(entry => {
                        if (!standardProps.has(entry.name) && entry.kind !== ts.ScriptElementKind.warning) {
                            const newName = `☆${entry.name}`
                            prevCompletionsMap[newName] = {
                                originalName: entry.name,
                            }
                            return {
                                ...entry,
                                insertText: entry.insertText ?? entry.name,
                                name: newName,
                            }
                        }

                        return entry
                    })
                }

                if (c('patchToString.enable')) {
                    //     const indexToPatch = arrayMoveItemToFrom(
                    //         prior.entries,
                    //         ({ name }) => name === 'toExponential',
                    //         ({ name }) => name === 'toString',
                    //     )
                    const indexToPatch = prior.entries.findIndex(({ name }) => name === 'toString')
                    if (indexToPatch !== -1) {
                        prior.entries[indexToPatch]!.insertText = `${prior.entries[indexToPatch]!.insertText ?? prior.entries[indexToPatch]!.name}()`
                        prior.entries[indexToPatch]!.kind = typescript.ScriptElementKind.constElement
                        // prior.entries[indexToPatch]!.isSnippet = true
                    }
                }

                const banAutoImportPackages = c('suggestions.banAutoImportPackages')
                if (banAutoImportPackages?.length)
                    prior.entries = prior.entries.filter(entry => {
                        if (!entry.sourceDisplay) return true
                        const text = entry.sourceDisplay.map(item => item.text).join('')
                        if (text.startsWith('.')) return true
                        // TODO change to startsWith?
                        return !banAutoImportPackages.includes(text)
                    })

                if (c('suggestions.keywordsInsertText') === 'space') {
                    const charAhead = scriptSnapshot.getText(position, position + 1)
                    prior.entries = prior.entries.map(entry => {
                        if (entry.kind !== ts.ScriptElementKind.keyword) return entry
                        entry.insertText = charAhead === ' ' ? entry.name : `${entry.name} `
                        return entry
                    })
                }

                for (const rule of c('replaceSuggestions')) {
                    let foundIndex: number
                    const suggestion = prior.entries.find(({ name, kind }, index) => {
                        if (rule.suggestion !== name) return false
                        if (rule.filter?.kind && kind !== rule.filter.kind) return false
                        foundIndex = index
                        return true
                    })
                    if (!suggestion) continue

                    if (rule.delete) prior.entries.splice(foundIndex!, 1)

                    if (rule.duplicateOriginal) prior.entries.splice(rule.duplicateOriginal === 'above' ? foundIndex! : foundIndex! + 1, 0, { ...suggestion })

                    Object.assign(suggestion, rule.patch ?? {})
                    if (rule.patch?.insertText) suggestion.isSnippet = true
                }

                if (c('correctSorting.enable')) prior.entries = prior.entries.map((entry, index) => ({ ...entry, sortText: `${entry.sortText ?? ''}${index}` }))

                // console.log('signatureHelp', JSON.stringify(info.languageService.getSignatureHelpItems(fileName, position, {})))
                // console.timeEnd('slow-down')
                return prior
            }

            proxy.getCompletionEntryDetails = (fileName, position, entryName, formatOptions, source, preferences, data) => {
                const program = info.languageService.getProgram()
                const sourceFile = program?.getSourceFile(fileName)
                if (!program || !sourceFile) return
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

            // @ts-expect-error some experiments
            proxy.ignored = (fileName: string, positionOrRange: number, preferences: any) => {
                if (typeof positionOrRange !== 'number') positionOrRange = positionOrRange

                // ts.createSourceFile(fileName, sourceText, languageVersion)
                const { textSpan } = proxy.getSmartSelectionRange(fileName, positionOrRange)
                console.log('textSpan.start', textSpan.start, textSpan.length)
                const program = info.languageService.getProgram()
                const sourceFile = program?.getSourceFile(fileName)
                if (!program || !sourceFile) return []
                const originalSourceText = sourceFile.text
                // sourceFile.update('test', { span: textSpan, newLength: sourceFile.text.length + 2 })
                // sourceFile.text = patchText(sourceFile.text, textSpan.start, textSpan.start + textSpan.length, 'test')
                // console.log('sourceFile.text', sourceFile.text)
                const node = findChildContainingPosition(typescript, sourceFile, positionOrRange)
                if (!node) {
                    console.log('no node')
                    return []
                }

                // console.log(
                //     'special 1',
                //     typescript.isJsxExpression(node),
                //     typescript.isJsxElement(node),
                //     typescript.isJsxText(node),
                //     typescript.isJsxExpression(node.parent),
                //     typescript.isJsxElement(node.parent),
                //     typescript.isJsxOpeningElement(node.parent),
                // )
                const typeChecker = program.getTypeChecker()
                const type = typeChecker.getTypeAtLocation(node)
                const parentType = typeChecker.getTypeAtLocation(node.parent)
                // console.log(
                //     'extracted.getCallSignatures()',
                //     type.getCallSignatures().map(item => item.getParameters().map(item => item.name)),
                // )
                sourceFile.text = originalSourceText
            }

            return proxy
        },
        onConfigurationChanged(config: any) {
            console.log('inspect config', JSON.stringify(config))
            _configuration = config
        },
    }
}

const appendInsertText = () => {}

type ArrayPredicate<T> = (value: T, index: number) => boolean
const arrayMoveItemToFrom = <T>(array: T[], originalItem: ArrayPredicate<T>, itemToMove: ArrayPredicate<T>) => {
    const originalItemIndex = array.findIndex(originalItem)
    if (originalItemIndex === -1) return undefined
    const itemToMoveIndex = array.findIndex(itemToMove)
    if (itemToMoveIndex === -1) return undefined
    array.splice(originalItemIndex, 0, array[itemToMoveIndex]!)
    array.splice(itemToMoveIndex + 1, 1)
    return originalItemIndex
}

const patchText = (input: string, start: number, end: number, newText: string) => input.slice(0, start) + newText + input.slice(end)

function findChildContainingPosition(
    typescript: typeof import('typescript/lib/tsserverlibrary'),
    sourceFile: tslib.SourceFile,
    position: number,
): tslib.Node | undefined {
    function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.getStart() && position < node.getEnd()) return typescript.forEachChild(node, find) || node

        return
    }
    return find(sourceFile)
}
