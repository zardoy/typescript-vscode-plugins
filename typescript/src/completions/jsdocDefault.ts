import { findChildContainingPositionIncludingStartTrivia } from '../utils'

export const getJsdocDefaultTypes = (position: number, sourceFile: ts.SourceFile, languageService: ts.LanguageService) => {
    const fileText = sourceFile.getFullText().slice(0, position)
    const textBeforeWord = fileText.slice(0, /[-\w\d]*$/i.exec(fileText)!.index)
    if (!textBeforeWord.endsWith('@default ')) return
    const comment = languageService.getSpanOfEnclosingComment(sourceFile.fileName, position, false)
    if (!comment) return
    let node = findChildContainingPositionIncludingStartTrivia(ts, sourceFile, position)
    if (!node) return
    if (ts.isVariableDeclarationList(node)) node = node.declarations[0]
    if (!node) return
    const typeChecker = languageService.getProgram()!.getTypeChecker()!
    try {
        const type = typeChecker.getTypeAtLocation(node)
        if (!type.isUnion()) return
        const suggestions: [name: string, type: ts.Type, isLiteral: boolean][] = []
        for (const nextType of type.types) {
            const addSuggestions = (isLiteral: boolean, ...addSuggestions: string[]) => {
                suggestions.push(...addSuggestions.map(suggestion => [suggestion, nextType, isLiteral] as [string, ts.Type, boolean]))
            }
            if (nextType.isLiteral()) addSuggestions(true, nextType.value.toString())
            else if (nextType.flags & ts.TypeFlags.BooleanLiteral) addSuggestions(true, nextType['intrinsicName'])
            else if (nextType.flags & ts.TypeFlags.Boolean) addSuggestions(false, 'true', 'false')
            else if (nextType.flags & ts.TypeFlags.Undefined) addSuggestions(false, 'undefined')
            else if (nextType.flags & ts.TypeFlags.Null) addSuggestions(false, 'null')
        }
        return suggestions
    } catch (err) {
        return
    }

    return
}

export default (
    entries: ts.CompletionEntry[],
    position: number,
    sourceFile: ts.SourceFile,
    languageService: ts.LanguageService,
): ts.CompletionEntry[] | undefined => {
    const suggestions = getJsdocDefaultTypes(position, sourceFile, languageService)
    if (!suggestions) return
    return [
        ...[...new Set(suggestions)].map(
            ([s]): ts.CompletionEntry => ({
                name: s,
                sortText: '07',
                kind: ts.ScriptElementKind.string,
            }),
        ),
        ...entries,
    ] as ts.CompletionEntry[]
}
