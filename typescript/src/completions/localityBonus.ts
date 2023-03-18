import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    let { node, sourceFile, c } = sharedCompletionContext
    if (!c('suggestions.localityBonus')) return

    const getScore = entry => {
        const symbol: ts.Symbol | undefined = entry['symbol']
        if (!symbol) return
        const { valueDeclaration } = symbol
        if (!valueDeclaration) return
        if (valueDeclaration.getSourceFile().fileName !== sourceFile.fileName) return -1
        return valueDeclaration.pos
    }
    if (!node) return
    return [...entries].sort((a, b) => {
        const aScore = getScore(a)
        const bScore = getScore(b)
        if (aScore === undefined || bScore === undefined) return 0
        return bScore - aScore
    })
}
