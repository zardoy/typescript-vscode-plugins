import { GetConfig } from '../types'

export default (
    entries: ts.CompletionEntry[],
    node: ts.Node,
    languageService: ts.LanguageService,
    preferences: ts.UserPreferences,
    c: GetConfig,
): ts.CompletionEntry[] | void => {
    if (entries.length && node) {
        const enableMoreVariants = c('objectLiteralCompletions.moreVariants')
        const keepOriginal = c('objectLiteralCompletions.keepOriginal')
        if (!preferences.includeCompletionsWithObjectLiteralMethodSnippets && !enableMoreVariants) return
        // plans to make it hihgly configurable! e.g. if user wants to make some subtype leading (e.g. from [] | {})
        if (ts.isIdentifier(node)) node = node.parent
        if (ts.isShorthandPropertyAssignment(node)) node = node.parent
        const addEntries: ts.CompletionEntry[] = []
        const completionIndexesToRemove: number[] = []
        entries = [...entries]
        if (ts.isObjectLiteralExpression(node)) {
            const typeChecker = languageService.getProgram()!.getTypeChecker()!
            const objType = typeChecker.getContextualType(node)
            if (!objType) return
            const properties = objType.getProperties()
            for (const property of properties) {
                const entry = entries.find(({ name }) => name === property.name)
                if (!entry) return
                const type = typeChecker.getTypeOfSymbolAtLocation(property, node)
                if (!type) continue
                if (isMethodCompletionCall(type, typeChecker)) {
                    if (keepOriginal === 'remove') completionIndexesToRemove.push(entries.indexOf(entry))
                    continue
                }
                if (!enableMoreVariants) continue
                const getQuotedSnippet = (): [string, string] => {
                    const quote = tsFull.getQuoteFromPreference(tsFull.getQuotePreference(node.getSourceFile() as any, preferences))
                    return [`: ${quote}$1${quote},$0`, `: ${quote}${quote},`]
                }
                const insertObjectArrayInnerText = c('objectLiteralCompletions.insertNewLine') ? '\n\t$1\n' : '$1'
                const completingStyleMap = [
                    [getQuotedSnippet, isStringCompletion],
                    [[`: [${insertObjectArrayInnerText}],$0`, `: [],`], isArrayCompletion],
                    [[`: {${insertObjectArrayInnerText}},$0`, `: {}`], isObjectCompletion],
                ] as const
                const insertSnippetVariant = completingStyleMap.find(([, detector]) => detector(type, typeChecker))?.[0]
                if (!insertSnippetVariant) continue
                const [insertSnippetText, insertSnippetPreview] = typeof insertSnippetVariant === 'function' ? insertSnippetVariant() : insertSnippetVariant
                const insertText = entry.name + insertSnippetText
                addEntries.push({
                    ...entry,
                    // todo setting incompatible!!!
                    sortText: entry.sortText,
                    labelDetails: {
                        detail: insertSnippetPreview,
                    },
                    insertText,
                    isSnippet: true,
                })
                if (keepOriginal === 'remove') entries.splice(entries.indexOf(entry), 1)
            }
            if ((keepOriginal === 'above' || keepOriginal === 'remove') && preferences.includeCompletionsWithObjectLiteralMethodSnippets) {
                const metMethodCompletions: string[] = []
                entries = entries.filter((entry, i) => {
                    if (completionIndexesToRemove.includes(i)) return false

                    const { detail } = entry.labelDetails ?? {}
                    if (detail?.startsWith('(') && detail.split('\n')[0]!.trimEnd().endsWith(')')) {
                        addEntries.push(entry)
                        metMethodCompletions.push(entry.name)
                        return false
                    }
                    if (
                        keepOriginal === 'remove' &&
                        entry.kind === ts.ScriptElementKind.memberFunctionElement &&
                        !detail &&
                        metMethodCompletions.includes(entry.name)
                    ) {
                        return false
                    }
                    return true
                })
            }
            return keepOriginal === 'above' ? [...addEntries, ...entries] : [...entries, ...addEntries]
        }
    }
}

const isMethodCompletionCall = (type: ts.Type, checker: ts.TypeChecker) => {
    if (checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0) return true
    if (type.isUnion()) return type.types.some(type => isMethodCompletionCall(type, checker))
}

const isStringCompletion = (type: ts.Type) => {
    if (type.flags & ts.TypeFlags.Undefined) return true
    if (type.isStringLiteral()) return true
    if (type.isUnion()) return type.types.every(type => isStringCompletion(type))
    return false
}

const isArrayCompletion = (type: ts.Type, checker: ts.TypeChecker) => {
    if (type.flags & ts.TypeFlags.Undefined) return true
    if (checker['isArrayLikeType'](type)) return true
    if (type.isUnion()) return type.types.every(type => isArrayCompletion(type, checker))
    return false
}

const isObjectCompletion = (type: ts.Type) => {
    if (type.flags & ts.TypeFlags.Undefined) return true
    if (type.flags & ts.TypeFlags.Object) return true
    if (type.isUnion()) return type.types.every(type => isObjectCompletion(type))
    return false
}
