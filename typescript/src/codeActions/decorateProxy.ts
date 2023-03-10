import { compact } from '@zardoy/utils'
import { previousGetCodeActionsResult } from '../specialCommands/handle'
import { GetConfig } from '../types'
import { handleFunctionRefactorEdits, processApplicableRefactors } from './functionExtractors'
import getCustomCodeActions, { REFACTORS_CATEGORY } from './getCodeActions'
import improveBuiltin from './improveBuiltin'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, languageServiceHost: ts.LanguageServiceHost, c: GetConfig) => {
    proxy.getApplicableRefactors = (fileName, positionOrRange, preferences) => {
        let prior = languageService.getApplicableRefactors(fileName, positionOrRange, preferences)

        previousGetCodeActionsResult.value = compact(
            prior.flatMap(refactor => {
                const actions = refactor.actions.filter(action => !action.notApplicableReason).map(action => action.description)
                if (!actions.length) return
                return actions.map(action => ({ description: refactor.description, name: action }))
            }),
        )

        const program = languageService.getProgram()!
        const sourceFile = program.getSourceFile(fileName)!
        processApplicableRefactors(
            prior.find(r => r.description === 'Extract function'),
            c,
            positionOrRange,
            sourceFile,
        )

        if (c('markTsCodeActions.enable')) prior = prior.map(item => ({ ...item, description: `🔵 ${item.description}` }))

        const { info: refactorInfo } = getCustomCodeActions(sourceFile, positionOrRange, languageService, languageServiceHost, c)
        if (refactorInfo) prior = [...prior, refactorInfo]

        return prior
    }

    proxy.getEditsForRefactor = (fileName, formatOptions, positionOrRange, refactorName, actionName, preferences) => {
        const category = refactorName
        if (category === REFACTORS_CATEGORY) {
            const program = languageService.getProgram()
            const sourceFile = program!.getSourceFile(fileName)!
            const { edit } = getCustomCodeActions(sourceFile, positionOrRange, languageService, languageServiceHost, c, formatOptions, actionName)
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
