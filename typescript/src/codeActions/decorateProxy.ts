import { GetConfig } from '../types'
import getCodeActions, { REFACTORS_CATEGORY } from './getCodeActions'
import improveBuiltin from './improveBuiltin'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, c: GetConfig) => {
    proxy.getApplicableRefactors = (fileName, positionOrRange, preferences) => {
        let prior = languageService.getApplicableRefactors(fileName, positionOrRange, preferences)

        if (c('markTsCodeActions.enable')) prior = prior.map(item => ({ ...item, description: `🔵 ${item.description}` }))

        const program = languageService.getProgram()
        const sourceFile = program!.getSourceFile(fileName)!
        const { info: refactorInfo } = getCodeActions(sourceFile, positionOrRange)
        if (refactorInfo) prior = [...prior, refactorInfo]

        return prior
    }

    proxy.getEditsForRefactor = (fileName, formatOptions, positionOrRange, refactorName, actionName, preferences) => {
        const category = refactorName
        if (category === REFACTORS_CATEGORY) {
            const program = languageService.getProgram()
            const sourceFile = program!.getSourceFile(fileName)!
            const { edit } = getCodeActions(sourceFile, positionOrRange, actionName)
            return edit
        }
        const prior = languageService.getEditsForRefactor(fileName, formatOptions, positionOrRange, refactorName, actionName, preferences)
        if (!prior) return
        return improveBuiltin(fileName, refactorName, actionName, languageService, c, prior) ?? prior
    }
}
