import fs from 'fs'
import { join } from 'path/posix'
import ts_module from 'typescript/lib/tsserverlibrary'

export = function ({ typescript }: { typescript: typeof ts_module }) {
    return {
        create(info: ts.server.PluginCreateInfo) {
            // Set up decorator object
            const proxy: ts.LanguageService = Object.create(null)

            for (const k of Object.keys(info.languageService)) {
                const x = info.languageService[k]!
                // @ts-expect-error - JS runtime trickery which is tricky to type tersely
                proxy[k] = (...args: Array<Record<string, unknown>>) => x.apply(info.languageService, args)
            }

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
                // Feature: Force Suggestion Sorting
                prior.entries = prior.entries.map((entry, index) => ({ ...entry, sortText: `${entry.sortText ?? ''}${index}` }))
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
                // console.timeEnd('slow-down')
                return prior
            }

            proxy.getCodeFixesAtPosition = (fileName, start, end, errorCodes, formatOptions, preferences) => {
                const prior = info.languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences)

                // Feature: Remove useless code actions
                return prior.filter(({ fixName }) => !['fixMissingFunctionDeclaration'].includes(fixName))
            }

            return proxy
        },
        onConfigurationChanged(config: any) {
            // Receive configuration changes sent from VS Code
        },
    }
}
