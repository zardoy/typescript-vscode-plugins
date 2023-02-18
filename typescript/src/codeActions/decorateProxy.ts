import { GetConfig } from '../types'
import { handleFunctionRefactorEdits, processApplicableRefactors } from './functionExtractors'
import getCodeActions, { REFACTORS_CATEGORY } from './getCodeActions'
import improveBuiltin from './improveBuiltin'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, languageServiceHost: ts.LanguageServiceHost, c: GetConfig) => {
    proxy.getApplicableRefactors = (fileName, positionOrRange, preferences) => {
        let prior = languageService.getApplicableRefactors(fileName, positionOrRange, preferences)

        processApplicableRefactors(
            prior.find(r => r.description === 'Extract function'),
            c,
        )

        if (c('markTsCodeActions.enable')) prior = prior.map(item => ({ ...item, description: `🔵 ${item.description}` }))

        const program = languageService.getProgram()
        const sourceFile = program!.getSourceFile(fileName)!
        const { info: refactorInfo } = getCodeActions(sourceFile, positionOrRange, languageService, languageServiceHost)
        if (refactorInfo) prior = [...prior, refactorInfo]

        return prior
    }

    proxy.getEditsForRefactor = (fileName, formatOptions, positionOrRange, refactorName, actionName, preferences) => {
        const category = refactorName
        if (category === REFACTORS_CATEGORY) {
            const program = languageService.getProgram()
            const sourceFile = program!.getSourceFile(fileName)!
            const { edit } = getCodeActions(sourceFile, positionOrRange, languageService, languageServiceHost, formatOptions, actionName)
            return edit
        }
        if (refactorName === 'Extract Symbol' && actionName.startsWith('function_scope')) {
            const handledResult = handleFunctionRefactorEdits(actionName, languageService, fileName, formatOptions, positionOrRange, refactorName, preferences)
            if (handledResult) return handledResult
        }
        const prior = languageService.getEditsForRefactor(fileName, formatOptions, positionOrRange, refactorName, actionName, preferences)
        if (!prior) return
        return improveBuiltin(fileName, refactorName, actionName, languageService, c, prior) ?? prior
    }
}
