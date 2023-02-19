import { oneOf } from '@zardoy/utils'
import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    const { languageService } = sharedCompletionContext

    const typeChecker = languageService.getProgram()!.getTypeChecker()!
    let timeSpend = 0
    const newEntries = entries.map(entry => {
        const patch = (): ts.CompletionEntry | undefined => {
            const { kind } = entry
            if (
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
            const symbol = entry['symbol'] as ts.Symbol | undefined
            if (!symbol) return
            const { valueDeclaration } = symbol
            if (!valueDeclaration) return

            const dateNow = Date.now()
            const type = typeChecker.getTypeOfSymbolAtLocation(symbol, valueDeclaration)
            const signatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
            timeSpend += Date.now() - dateNow
            if (signatures.length === 0) return

            return { ...entry, kind: ts.ScriptElementKind.functionElement }
        }

        return patch() ?? entry
    })

    // remove logging once stable
    console.log('changeKindToFunction time:', timeSpend)

    return newEntries
}
