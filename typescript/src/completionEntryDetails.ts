import { PrevCompletionMap, PrevCompletionsAdditionalData } from './completionsAtPosition'
import constructMethodSnippet from './constructMethodSnippet'
import { RequestOutputTypes } from './ipcTypes'
import namespaceAutoImports from './namespaceAutoImports'
import { GetConfig } from './types'
import { wordStartAtPos } from './utils'

export const lastResolvedCompletion = {
    value: undefined as undefined | RequestOutputTypes['getLastResolvedCompletion'],
}

export default function completionEntryDetails(
    inputArgs: Parameters<ts.LanguageService['getCompletionEntryDetails']>,
    languageService: ts.LanguageService,
    prevCompletionsMap: PrevCompletionMap,
    c: GetConfig,
    { enableMethodCompletion, completionsSymbolMap }: PrevCompletionsAdditionalData,
): ts.CompletionEntryDetails | undefined {
    const [fileName, position, entryName, formatOptions, source, preferences, data] = inputArgs
    lastResolvedCompletion.value = { name: entryName, range: prevCompletionsMap[entryName]?.range }
    const program = languageService.getProgram()
    const sourceFile = program?.getSourceFile(fileName)
    if (!program || !sourceFile) return

    const { documentationOverride, documentationAppend, detailPrepend, textChanges } = prevCompletionsMap[entryName] ?? {}
    if (documentationOverride) {
        const prior: ts.CompletionEntryDetails = {
            name: entryName,
            kind: ts.ScriptElementKind.alias,
            kindModifiers: '',
            displayParts: typeof documentationOverride === 'string' ? [{ kind: 'text', text: documentationOverride }] : documentationOverride,
        }
        if (textChanges) {
            prior.codeActions = [
                // ...(prior.codeActions ?? []),
                {
                    description: 'Includes Text Changes',
                    changes: [
                        {
                            fileName,
                            textChanges,
                        },
                    ],
                },
            ]
        }
        return prior
    }
    let prior = languageService.getCompletionEntryDetails(
        fileName,
        position,
        prevCompletionsMap[entryName]?.originalName || entryName,
        formatOptions,
        source,
        preferences,
        data,
    )
    if (detailPrepend) {
        prior ??= {
            name: entryName,
            kind: ts.ScriptElementKind.alias,
            kindModifiers: '',
            displayParts: [],
        }
        prior.displayParts = [{ kind: 'text', text: detailPrepend }, ...prior.displayParts]
    }
    if (!prior) return
    // might be incorrect: write [].entries() -> []|.entries|() -> []./*position*/e
    const nextChar = sourceFile.getFullText().slice(position, position + 1)

    if (enableMethodCompletion && c('enableMethodSnippets') && !['(', '.', '`'].includes(nextChar)) {
        const symbol = completionsSymbolMap.get(entryName)?.find(c => c.source === source)?.symbol
        if (symbol) {
            const resolveData = {
                isAmbiguous: false,
            }
            const methodSnippet = constructMethodSnippet(languageService, sourceFile, position, symbol, c, resolveData)
            if (methodSnippet) {
                const wordStartOffset = source ? wordStartAtPos(sourceFile.getFullText(), position) : undefined
                const data = JSON.stringify({
                    methodSnippet,
                    isAmbiguous: resolveData.isAmbiguous,
                    wordStartOffset,
                })
                prior.documentation = [{ kind: 'text', text: `<!--tep ${data} e-->` }, ...(prior.documentation ?? [])]
            }
        }
    }
    if (source) {
        const namespaceImport = namespaceAutoImports(
            c,
            languageService.getProgram()!.getSourceFile(fileName)!,
            source,
            preferences ?? {},
            formatOptions ?? {},
            position,
            entryName,
            prior,
        )
        if (namespaceImport) {
            const { textChanges, description } = namespaceImport
            const namespace = textChanges[0]!.newText.slice(0, -1)
            // todo-low think of cleanin up builtin code actions descriptions
            prior.codeActions = [
                // ...(prior.codeActions ?? []),
                {
                    description,
                    changes: [
                        {
                            fileName,
                            textChanges,
                        },
                    ],
                },
            ]
        }
    }
    if (documentationAppend) {
        prior.documentation = [...(prior.documentation ?? []), { kind: 'text', text: documentationAppend }]
    }
    return prior
}
