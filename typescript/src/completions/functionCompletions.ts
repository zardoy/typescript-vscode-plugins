import { oneOf } from '@zardoy/utils'
import constructMethodSnippet from '../constructMethodSnippet'
import { insertTextAfterEntry } from '../utils'
import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    const { languageService, c, sourceFile, position } = sharedCompletionContext

    const methodSnippetInsertTextMode = c('methodSnippetsInsertText')
    const nextChar = sourceFile.getFullText().slice(position, position + 1)
    const enableResolvingInsertText = !['(', '.', '`'].includes(nextChar) && c('enableMethodSnippets') && methodSnippetInsertTextMode !== 'disable'
    const changeKindToFunction = c('experiments.changeKindToFunction')

    if (!enableResolvingInsertText && !changeKindToFunction) return

    const typeChecker = languageService.getProgram()!.getTypeChecker()!
    // let timeSpend = 0
    const newEntries = entries.map(entry => {
        const patch = (): ts.CompletionEntry | undefined => {
            const { kind, symbol } = entry
            if (
                !enableResolvingInsertText &&
                !oneOf(
                    kind,
                    ts.ScriptElementKind.alias,
                    ts.ScriptElementKind.memberVariableElement,
                    ts.ScriptElementKind.variableElement,
                    ts.ScriptElementKind.localVariableElement,
                    ts.ScriptElementKind.constElement,
                    ts.ScriptElementKind.variableElement,
                )
            ) {
                return
            }
            if (methodSnippetInsertTextMode === 'only-local' && entry.source) return
            if (!symbol) return
            const { valueDeclaration = symbol.declarations?.[0] } = symbol
            if (!valueDeclaration) return

            // const dateNow = Date.now()
            if (enableResolvingInsertText) {
                const resolveData = {} as { isAmbiguous: boolean }
                const methodSnippet = constructMethodSnippet(languageService, sourceFile, position, symbol, c, resolveData)
                if (!methodSnippet || resolveData.isAmbiguous) return
                return {
                    ...entry,
                    insertText: insertTextAfterEntry(entry.insertText ?? entry.name, `(${methodSnippet.map((x, i) => `$\{${i + 1}:${x}}`).join(', ')})`),
                    labelDetails: {
                        detail: `(${methodSnippet.join(', ')})`,
                        description: ts.displayPartsToString(entry.sourceDisplay),
                    },
                    kind: changeKindToFunction ? ts.ScriptElementKind.functionElement : entry.kind,
                    isSnippet: true,
                }
            }
            const type = typeChecker.getTypeOfSymbolAtLocation(symbol, valueDeclaration)
            const signatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
            // timeSpend += Date.now() - dateNow
            if (signatures.length === 0) return

            return { ...entry, kind: ts.ScriptElementKind.functionElement }
        }

        return patch() ?? entry
    })

    // remove logging once stable
    // console.log('changeKindToFunction time:', timeSpend)

    return newEntries
}
