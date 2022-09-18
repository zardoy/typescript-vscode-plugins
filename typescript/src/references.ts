import type tslib from 'typescript/lib/tsserverlibrary'
import { GetConfig } from './types'

export default (proxy: tslib.LanguageService, languageService: tslib.LanguageService, c: GetConfig) => {
    proxy.findReferences = (fileName, position) => {
        let prior = languageService.findReferences(fileName, position)
        if (!prior) return
        if (c('removeDefinitionFromReferences')) {
            prior = prior.map(({ references, ...other }) => ({
                ...other,
                references: references.filter(({ isDefinition }) => !isDefinition),
            }))
        }
        return prior
    }
}
