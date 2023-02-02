import { GetConfig } from './types'
import { patchMethod } from './utils'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, c: GetConfig) => {
    // const oldGetAllRules = tsFull.formatting.getAllRules;
    // tsFull.formatting.getAllRules = () => {
    // }

    const isFormattingLineIgnored = (sourceFile: ts.SourceFile, position: number) => {
        // const sourceFile = languageService.getProgram()!.getSourceFile(fileName)!
        const fullText = sourceFile.getFullText()
        // check that lines before line are not ignored
        const linesBefore = fullText.slice(0, position).split('\n')
        if (linesBefore[linesBefore.length - 2]?.trim() === '//@ts-format-ignore-line') {
            return true
        }

        let isInsideIgnoredRegion = false
        for (const line of linesBefore) {
            if (line.trim() === '//@ts-format-ignore-region') {
                isInsideIgnoredRegion = true
            }
            if (line.trim() === '//@ts-format-ignore-endregion') {
                isInsideIgnoredRegion = false
            }
        }
        return isInsideIgnoredRegion
    }
    // proxy.getFormattingEditsAfterKeystroke = (fileName, position, key, options) => {
    //     // if (isFormattingLineIgnored(fileName, position)) {
    //     //     return []
    //     // }
    //     return languageService.getFormattingEditsAfterKeystroke(fileName, position, key, options)
    // }
    // proxy.getFormattingEditsForDocument = (fileName, options) => {
    //     return []
    // }
    const toPatchFormatMethods = ['formatSelection', 'formatOnOpeningCurly', 'formatOnClosingCurly', 'formatOnSemicolon', 'formatOnEnter']
    for (const toPatchFormatMethod of toPatchFormatMethods) {
        patchMethod(tsFull.formatting, toPatchFormatMethod as any, oldFn => (...args) => {
            const result = oldFn(...args)
            const sourceFile = args.find(arg => ts.isSourceFile(arg as any))
            return result.filter(({ span }) => {
                if (isFormattingLineIgnored(sourceFile as ts.SourceFile, span.start)) {
                    return false
                }
                return true
            })
        })
    }
    // proxy.getFormattingEditsForRange = (fileName, start, end, options) => {
    //     return languageService.getFormattingEditsForRange(fileName, start, end, options).filter(({ span }) => {
    //         if (isFormattingLineIgnored(fileName, span.start)) {
    //             return false
    //         }
    //         return true
    //     })
    // }
}
