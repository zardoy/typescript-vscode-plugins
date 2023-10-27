import { oneOf } from '@zardoy/utils'
import constructMethodSnippet from '../constructMethodSnippet'
import { insertTextAfterEntry, wordRangeAtPos } from '../utils'
import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    const { languageService, c, sourceFile, position, prior } = sharedCompletionContext

    const methodSnippetInsertTextMode = c('methodSnippets.previewSignature')
    const fullText = sourceFile.getFullText()
    const nextChar = fullText.slice(position, position + 1)
    const prevChar = fullText.slice(position - 1, position)
    const isMethodSnippetInsertTextModeEnabled = methodSnippetInsertTextMode !== 'disable'

    const enableResolvingInsertText = !['(', '.', '`'].includes(nextChar) && c('enableMethodSnippets') && isMethodSnippetInsertTextModeEnabled

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
            if (enableResolvingInsertText && !entry.isSnippet) {
                const resolveData = {} as { isAmbiguous: boolean }
                const methodSnippet = constructMethodSnippet(languageService, sourceFile, position, symbol, c, resolveData)
                if (!methodSnippet || resolveData.isAmbiguous) return
                const originalText = entry.insertText ?? entry.name
                const insertTextSnippetAdd = `(${methodSnippet.map((x, i) => `$\{${i + 1}:${x}}`).join(', ')})`
                // https://github.com/zardoy/typescript-vscode-plugins/issues/161
                // todo implement workaround for ?. as well
                const beforeDotWorkaround = !entry.replacementSpan && prior.isMemberCompletion && prevChar === '.'
                return {
                    ...entry,
                    insertText: (beforeDotWorkaround ? '.' : '') + insertTextAfterEntry(originalText, insertTextSnippetAdd),
                    labelDetails: {
                        detail: `(${methodSnippet.join(', ')})`,
                        description: ts.displayPartsToString(entry.sourceDisplay),
                    },
                    replacementSpan: beforeDotWorkaround
                        ? {
                              start: position - 1,
                              length: (c('editorSuggestInsertModeReplace') ? wordRangeAtPos(fullText, position).length : 0) + 1,
                          }
                        : entry.replacementSpan,
                    kind: ts.ScriptElementKind.functionElement,
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
