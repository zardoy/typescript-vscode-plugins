import { oneOf } from '@zardoy/utils'
import { getParameterListParts } from './completions/snippetForFunctionCall'
import { PrevCompletionsAdditionalData } from './completionsAtPosition'
import { GetConfig } from './types'

export default (
    languageService: ts.LanguageService,
    c: GetConfig,
    fileName: string,
    position: number,
    sourceFile: ts.SourceFile,
    prior: ts.CompletionEntryDetails,
    { enableMethodCompletion }: PrevCompletionsAdditionalData,
) => {
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
