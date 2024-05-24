import { GetConfig } from './types'
import { findChildContainingPosition } from './utils'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, c: GetConfig) => {
    proxy.getDocumentHighlights = (fileName, position, filesToSearch, ...props) => {
        const prior = languageService.getDocumentHighlights(fileName, position, filesToSearch, ...props)
        if (!prior) return
        if (prior.length !== 1 || c('disableUselessHighlighting') === 'disable') return prior
        const node = findChildContainingPosition(ts, languageService.getProgram()!.getSourceFile(fileName)!, position)
        if (!node) return prior
        if (ts.isStringLiteralLike(node) && (c('disableUselessHighlighting') === 'inAllStrings' || ts.isJsxAttribute(node.parent))) {
            return
        }
        return prior
    }
}
