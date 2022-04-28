import fs from 'fs'
import { join } from 'path/posix'
import tslib, { SymbolDisplayPartKind, TypeFlags, TypeFormatFlags } from 'typescript/lib/tsserverlibrary'

export = function ({ typescript }: { typescript: typeof tslib }) {
    return {
        create(info: ts.server.PluginCreateInfo) {
            // Set up decorator object
            const proxy: ts.LanguageService = Object.create(null)

            for (const k of Object.keys(info.languageService)) {
                const x = info.languageService[k]!
                // @ts-expect-error - JS runtime trickery which is tricky to type tersely
                proxy[k] = (...args: Array<Record<string, unknown>>) => x.apply(info.languageService, args)
            }

            let prevCompletions
            proxy.getCompletionsAtPosition = (fileName, position, options) => {
                const prior = info.languageService.getCompletionsAtPosition(fileName, position, options)
                if (!prior) return
                // console.time('slow-down')
                const scriptSnapshot = info.project.getScriptSnapshot(fileName)
                const { line, character } = info.languageService.toLineColumnOffset!(fileName, position)
                if (!scriptSnapshot) return
                // const fullText = scriptSnapshot.getText(0, scriptSnapshot.getLength())
                // const matchImport = /(import (.*)from )['"].*['"]/.exec(fullText.split('\n')[line]!)?.[1]
                // if (matchImport && character <= `import${matchImport}`.length) {
                //     console.log('override')
                //     return
                // }
                // prior.isGlobalCompletion
                // prior.entries[0]
                if (['bind', 'call', 'caller'].every(name => prior.entries.find(entry => entry.name === name))) {
                    // Feature: Remove useless function props
                    prior.entries = prior.entries.filter(e => !['Symbol', 'caller', 'prototype'].includes(e.name))
                    // Feature: Highlight and lift non-function methods
                    const standardProps = ['Symbol', 'apply', 'arguments', 'bind', 'call', 'caller', 'length', 'name', 'prototype', 'toString']
                    prior.entries = prior.entries.map(entry => {
                        if (!standardProps.includes(entry.name)) {
                            return { ...entry, insertText: entry.insertText ?? entry.name, name: `☆${entry.name}` }
                        }
                        return entry
                    })
                }
                // Feature: Force Suggestion Sorting
                prior.entries = prior.entries.map((entry, index) => ({ ...entry, sortText: `${entry.sortText ?? ''}${index}` }))
                // console.log('signatureHelp', JSON.stringify(info.languageService.getSignatureHelpItems(fileName, position, {})))
                // console.timeEnd('slow-down')
                return prior
            }

            proxy.getCompletionEntryDetails = (fileName, position, entryName, formatOptions, source, preferences, data) => {
                console.log('source', source)
                const prior = info.languageService.getCompletionEntryDetails(fileName, position, entryName, formatOptions, source, preferences, data)
                if (!prior) return
                prior.codeActions = [{ description: '', changes: [{ fileName, textChanges: [{ span: { start: position, length: 0 }, newText: '()' }] }] }]
                // formatOptions
                // info.languageService.getDefinitionAtPosition(fileName, position)
                return prior
            }

            proxy.getApplicableRefactors = (fileName, positionOrRange, preferences) => {
                if (typeof positionOrRange !== 'number') {
                    positionOrRange = positionOrRange.pos
                }
                const { textSpan } = proxy.getSmartSelectionRange(fileName, positionOrRange)
                console.log('textSpan.start', textSpan.start, textSpan.length)
                const program = info.languageService.getProgram()
                const sourceFile = program?.getSourceFile(fileName)

                if (!program || !sourceFile) return []
                const originalSourceText = sourceFile.text
                // sourceFile.update('test', { span: textSpan, newLength: sourceFile.text.length + 2 })
                // sourceFile.text = patchText(sourceFile.text, textSpan.start, textSpan.start + textSpan.length, 'test')
                // console.log('sourceFile.text', sourceFile.text)
                const node = findChildContainingPosition(sourceFile, positionOrRange)
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

                const prior = info.languageService.getApplicableRefactors(fileName, positionOrRange, preferences)

                return []
                // Feature: Remove useless code actions
                // return prior.filter(({ fixName }) => !['fixMissingFunctionDeclaration'].includes(fixName))
            }

            return proxy
        },
        onConfigurationChanged(config: any) {
            // Receive configuration changes sent from VS Code
        },
    }
}

const patchText = (input: string, start: number, end: number, newText: string) => {
    return input.slice(0, start) + newText + input.slice(end)
}

function findChildContainingPosition(sourceFile: tslib.SourceFile, position: number): tslib.Node | undefined {
    function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.getStart() && position < node.getEnd()) {
            return tslib.forEachChild(node, find) || node
        }
        return
    }
    return find(sourceFile)
}
