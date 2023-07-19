import getImportPath from '../utils/getImportPath'
import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    const { c, prevCompletionsMap } = sharedCompletionContext

    const displayImportedInfo = c('suggestions.displayImportedInfo')
    if (displayImportedInfo === 'disable') return

    for (const entry of entries) {
        const { symbol } = entry
        if (!symbol) continue
        let { quotedPath: importPath } = getImportPath(symbol) ?? {}
        if (!importPath) continue

        prevCompletionsMap[entry.name] ??= {}
        const symbolsLimit = 40
        if (importPath.length > symbolsLimit) importPath = `${importPath.slice(0, symbolsLimit / 2)}...${importPath.slice(-symbolsLimit / 2)}`
        const detailPrepend = displayImportedInfo === 'short-format' ? `(from ${importPath}) ` : `Imported from ${importPath}\n\n`
        prevCompletionsMap[entry.name]!.detailPrepend = detailPrepend
    }
}
