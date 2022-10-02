import { GetConfig } from './types'
import { findChildContainingPosition } from './utils'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, c: GetConfig) => {
    proxy.getDocumentHighlights = (fileName, position, filesToSearch) => {
        const prior = languageService.getDocumentHighlights(fileName, position, filesToSearch)
        if (!prior) return
        if (prior.length !== 1) return prior
        const node = findChildContainingPosition(ts, languageService.getProgram()!.getSourceFile(fileName)!, position)
        if (!node) return prior
        if (c('disableUselessHighlighting') !== 'disable') {
            if (ts.isStringLiteralLike(node)) {
                if (c('disableUselessHighlighting') === 'inAllStrings') return
                else if (ts.isJsxAttribute(node.parent)) return
            }
        }
        return prior
    }
}
