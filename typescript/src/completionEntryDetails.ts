import { PrevCompletionMap, PrevCompletionsAdditionalData } from './completionsAtPosition'
import { RequestResponseTypes } from './ipcTypes'
import namespaceAutoImports from './namespaceAutoImports'
import { GetConfig } from './types'

export const lastResolvedCompletion = {
    value: undefined as undefined | RequestResponseTypes['getLastResolvedCompletion'],
}

export default function completionEntryDetails(
    inputArgs: Parameters<ts.LanguageService['getCompletionEntryDetails']>,
    languageService: ts.LanguageService,
    prevCompletionsMap: PrevCompletionMap,
    c: GetConfig,
    prevCompletionsAdittionalData: PrevCompletionsAdditionalData,
): ts.CompletionEntryDetails | undefined {
    const [fileName, position, entryName, formatOptions, source, preferences, data] = inputArgs
    lastResolvedCompletion.value = { name: entryName }
    const program = languageService.getProgram()
    const sourceFile = program?.getSourceFile(fileName)
    if (!program || !sourceFile) return

    const { documentationOverride, documentationAppend, detailPrepend } = prevCompletionsMap[entryName] ?? {}
    if (documentationOverride) {
        return {
            name: entryName,
            kind: ts.ScriptElementKind.alias,
            kindModifiers: '',
            displayParts: typeof documentationOverride === 'string' ? [{ kind: 'text', text: documentationOverride }] : documentationOverride,
        }
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
