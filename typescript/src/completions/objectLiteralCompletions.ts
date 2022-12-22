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
        if (!ts.isObjectLiteralExpression(node)) return

        entries = [...entries]
        const typeChecker = languageService.getProgram()!.getTypeChecker()!
        const objType = typeChecker.getContextualType(node)
        if (!objType) return
        // its doesn't return all actual properties in some cases e.g. it would be more correct to use symbols from entries, but there is a block from TS
        const properties = objType.getProperties()
        for (const property of properties) {
            const entry = entries.find(({ name }) => name === property.name)
            if (!entry) continue
            const type = typeChecker.getTypeOfSymbolAtLocation(property, node)
            if (!type) continue
            if (isMethodCompletionCall(type, typeChecker)) {
                if (['above', 'remove'].includes(keepOriginal) && preferences.includeCompletionsWithObjectLiteralMethodSnippets) {
                    const methodEntryIndex = entries.findIndex(e => e.name === entry.name && isObjectLiteralMethodSnippet(e))
                    const methodEntry = entries[methodEntryIndex]
                    if (methodEntry) {
                        entries.splice(methodEntryIndex, 1)
                        entries.splice(entries.indexOf(entry) + (keepOriginal === 'below' ? 1 : 0), keepOriginal === 'remove' ? 1 : 0, {
                            ...methodEntry,
                            // let correctSorting.enable sort it
                            sortText: entry.sortText,
                        })
                    }
                }
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
                [[`: {${insertObjectArrayInnerText}},$0`, `: {},`], isObjectCompletion],
            ] as const
            const fallbackSnippet = c('objectLiteralCompletions.fallbackVariant') ? ([': $0,', ': ,'] as const) : undefined
            const insertSnippetVariant = completingStyleMap.find(([, detector]) => detector(type, typeChecker))?.[0] ?? fallbackSnippet
            if (!insertSnippetVariant) continue
            const [insertSnippetText, insertSnippetPreview] = typeof insertSnippetVariant === 'function' ? insertSnippetVariant() : insertSnippetVariant
            const insertText = entry.name + insertSnippetText
            const index = entries.indexOf(entry)
            entries.splice(index + (keepOriginal === 'below' ? 1 : 0), keepOriginal === 'remove' ? 1 : 0, {
                ...entry,
                // todo setting incompatible!!!
                sortText: entry.sortText,
                labelDetails: {
                    detail: insertSnippetPreview,
                },
                insertText,
                isSnippet: true,
            })
        }
        return entries
    }
}

const isObjectLiteralMethodSnippet = (entry: ts.CompletionEntry) => {
    const { detail } = entry.labelDetails ?? {}
    return detail?.startsWith('(') && detail.split('\n')[0]!.trimEnd().endsWith(')')
}

const isMethodCompletionCall = (type: ts.Type, checker: ts.TypeChecker) => {
    if (checker.getSignaturesOfType(type, ts.SignatureKind.Call).length > 0) return true
    if (type.isUnion()) return type.types.some(type => isMethodCompletionCall(type, checker))
}

const isStringCompletion = (type: ts.Type) => {
    if (type.flags & ts.TypeFlags.Undefined) return true
    if (type.flags & ts.TypeFlags.StringLike) return true
    if (type.isUnion()) return type.types.every(type => isStringCompletion(type))
    return false
}

const isArrayCompletion = (type: ts.Type, checker: ts.TypeChecker) => {
    if (type.flags & ts.TypeFlags.Any) return false
    if (type.flags & ts.TypeFlags.Undefined) return true
    if (checker['isArrayLikeType'](type)) return true
    if (type.isUnion()) return type.types.every(type => isArrayCompletion(type, checker))
    return false
}

const isObjectCompletion = (type: ts.Type) => {
    if (type.flags & ts.TypeFlags.Undefined) return true
    if (type.flags & ts.TypeFlags.Object) {
        if ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Class) return false
        // complete with regexp?
        if (type.symbol?.escapedName === 'RegExp') return false
        return true
    }
    if (type.isUnion()) return type.types.every(type => isObjectCompletion(type))
    return false
}
