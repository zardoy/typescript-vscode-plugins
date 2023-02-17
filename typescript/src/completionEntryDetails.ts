import { oneOf } from '@zardoy/utils'
import { getParameterListParts } from './completions/snippetForFunctionCall'
import { PrevCompletionMap, PrevCompletionsAdditionalData } from './completionsAtPosition'
import namespaceAutoImports from './namespaceAutoImports'
import { GetConfig } from './types'

const handleMethodSnippets = (prior: ts.CompletionEntryDetails, c: GetConfig, { enableMethodCompletion }: PrevCompletionsAdditionalData) => {
    if (
        c('enableMethodSnippets') &&
        oneOf(
            prior.kind,
            ts.ScriptElementKind.constElement,
            ts.ScriptElementKind.letElement,
            ts.ScriptElementKind.alias,
            ts.ScriptElementKind.variableElement,
            ts.ScriptElementKind.memberVariableElement,
        )
    ) {
        // - 1 to look for possibly previous completing item
        let rawPartsOverride: ts.SymbolDisplayPart[] | undefined
        if (enableMethodCompletion && prior.kind === ts.ScriptElementKind.alias) {
            enableMethodCompletion =
                prior.displayParts[5]?.text === 'method' || (prior.displayParts[4]?.kind === 'keyword' && prior.displayParts[4].text === 'function')
            const { parts, gotMethodHit, hasOptionalParameters } = getParameterListParts(prior.displayParts)
            if (gotMethodHit) rawPartsOverride = hasOptionalParameters ? [...parts, { kind: '', text: ' ' }] : parts
        }
        const punctuationIndex = prior.displayParts.findIndex(({ kind, text }) => kind === 'punctuation' && text === ':')
        if (enableMethodCompletion && punctuationIndex !== 1) {
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

export default function completionEntryDetails(
    inputArgs: Parameters<ts.LanguageService['getCompletionEntryDetails']>,
    languageService: ts.LanguageService,
    prevCompletionsMap: PrevCompletionMap,
    c: GetConfig,
    prevCompletionsAdittionalData: PrevCompletionsAdditionalData,
): ts.CompletionEntryDetails | undefined {
    const [fileName, position, entryName, formatOptions, source, preferences, data] = inputArgs
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
    const prior = languageService.getCompletionEntryDetails(
        fileName,
        position,
        prevCompletionsMap[entryName]?.originalName || entryName,
        formatOptions,
        source,
        preferences,
        data,
    )
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
                    description: description,
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
    if (detailPrepend) {
        prior.displayParts = [{ kind: 'text', text: detailPrepend }, ...prior.displayParts]
    }
    if (documentationAppend) {
        prior.documentation = [...(prior.documentation ?? []), { kind: 'text', text: documentationAppend }]
    }
    return handleMethodSnippets(prior, c, prevCompletionsAdittionalData)
}
