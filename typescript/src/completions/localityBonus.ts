import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    const { node, sourceFile, c, position } = sharedCompletionContext
    if (!c('suggestions.localityBonus')) return

    if (!node) return
    const LOWEST_SCORE = node.getSourceFile().getFullText().length
    const getScore = (entry: ts.CompletionEntry) => {
        const { symbol } = entry
        if (!symbol) return
        const { valueDeclaration = symbol.declarations?.[0] } = symbol
        if (!valueDeclaration) return
        if (valueDeclaration.getSourceFile().fileName !== sourceFile.fileName) return LOWEST_SCORE
        const completionPos = valueDeclaration.pos + valueDeclaration.getLeadingTriviaWidth()
        if (c('suggestions.localityBonusMode') === 'nearest-to-position') {
            return Math.abs(completionPos - position)
        }
        return completionPos < position ? -position - completionPos : completionPos - position
    }
    return [...entries].sort((a, b) => {
        const aScore = getScore(a)
        const bScore = getScore(b)
        if (aScore === undefined || bScore === undefined) return 0
        return aScore - bScore
    })
}
