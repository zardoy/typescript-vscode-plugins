import { GetConfig } from './types'
import { patchMethod } from './utils'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, c: GetConfig) => {
    // todo: add our formatting rules!
    // tsFull.formatting.getAllRules

    const isExpectedDirective = (line: string | undefined, expected: string) => {
        if (!line) return false
        line = line.trim()
        if (!line.startsWith('//')) return false
        line = line.slice(2).trim()
        if (line.startsWith(expected)) return true
        return false
    }
    const isFormattingLineIgnored = (sourceFile: ts.SourceFile, position: number) => {
        const fullText = sourceFile.getFullText()
        // check that lines before line are not ignored
        const linesBefore = fullText.slice(0, position).split('\n')
        if (isExpectedDirective(linesBefore[linesBefore.length - 2], '@ts-format-ignore-line')) {
            return true
        }

        let isInsideIgnoredRegion = false
        for (const line of linesBefore) {
            if (isExpectedDirective(line, '@ts-format-ignore-region')) {
                isInsideIgnoredRegion = true
            }
            if (isExpectedDirective(line, '@ts-format-ignore-endregion')) {
                isInsideIgnoredRegion = false
            }
        }
        return isInsideIgnoredRegion
    }
    const toPatchFormatMethods = ['formatSelection', 'formatOnOpeningCurly', 'formatOnClosingCurly', 'formatOnSemicolon', 'formatOnEnter']
    for (const toPatchFormatMethod of toPatchFormatMethods) {
        patchMethod(tsFull.formatting, toPatchFormatMethod as any, oldFn => (...args) => {
            const result = oldFn(...args)
            // arg position depends on the method, so we need to find it
            const sourceFile = args.find(arg => ts.isSourceFile(arg as any))
            return result.filter(({ span }) => {
                if (isFormattingLineIgnored(sourceFile as ts.SourceFile, span.start)) {
                    return false
                }
                return true
            })
        })
    }
    // we could easily patch languageService methods getFormattingEditsForDocument, getFormattingEditsAfterKeystroke and getFormattingEditsForRange
    // but since formatting happens in syntax server, we don't have access to actual sourceFile, so we can't provide implementation
}
