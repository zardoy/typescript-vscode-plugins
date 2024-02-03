import { GetConfig } from './types'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, languageServiceHost: ts.LanguageServiceHost, c: GetConfig) => {
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
    const isFormattingLineIgnored = (fullText: string, position: number) => {
        // check that lines before line are not ignored
        const linesBefore = fullText.slice(0, position).split('\n')
        if (isExpectedDirective(linesBefore.at(-2), '@ts-format-ignore-line')) {
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

    for (const method of ['getFormattingEditsForDocument', 'getFormattingEditsForRange', 'getFormattingEditsAfterKeystroke'] satisfies Array<
        keyof ts.LanguageService
    >) {
        proxy[method] = (...args) => {
            const textChanges: ts.TextChange[] = (languageService[method] as any)(...args)
            const fileName = args[0]
            const scriptSnapshot = languageServiceHost.getScriptSnapshot(fileName)!
            const fileContent = scriptSnapshot.getText(0, scriptSnapshot.getLength())

            return textChanges.filter(({ span }) => {
                if (isFormattingLineIgnored(fileContent, span.start)) {
                    return false
                }
                return true
            })
        }
    }
}
