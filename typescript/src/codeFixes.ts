import type tslib from 'typescript/lib/tsserverlibrary'
import { GetConfig } from './types'
import { getIndentFromPos } from './utils'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, c: GetConfig) => {
    proxy.getCodeFixesAtPosition = (fileName, start, end, errorCodes, formatOptions, preferences) => {
        let prior = languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences)
        // fix builtin codefixes/refactorings
        prior.forEach(fix => {
            if (fix.fixName === 'fixConvertConstToLet') {
                const { start, length } = fix.changes[0]!.textChanges[0]!.span
                const fixedLength = 'const'.length as 5
                fix.changes[0]!.textChanges[0]!.span.start = start + length - fixedLength
                fix.changes[0]!.textChanges[0]!.span.length = fixedLength
            }
            return fix
        })
        const diagnostics = proxy.getSemanticDiagnostics(fileName)

        // https://github.com/Microsoft/TypeScript/blob/v4.5.5/src/compiler/diagnosticMessages.json#L458
        const appliableErrorCode = [1156, 1157].find(code => errorCodes.includes(code))
        if (appliableErrorCode) {
            const program = languageService.getProgram()
            const sourceFile = program!.getSourceFile(fileName)!
            const startIndent = getIndentFromPos(ts, sourceFile, end)
            const diagnostic = diagnostics.find(({ code }) => code === appliableErrorCode)!
            prior = [
                ...prior,
                {
                    fixName: 'wrapBlock',
                    description: 'Wrap in block',
                    changes: [
                        {
                            fileName,
                            textChanges: [
                                { span: { start: diagnostic.start!, length: 0 }, newText: `{\n${startIndent}\t` },
                                { span: { start: diagnostic.start! + diagnostic.length!, length: 0 }, newText: `\n${startIndent}}` },
                            ],
                        },
                    ],
                },
            ]
        }

        if (c('removeCodeFixes.enable')) {
            const toRemove = c('removeCodeFixes.codefixes')
            prior = prior.filter(({ fixName }) => !toRemove.includes(fixName as any))
        }

        if (c('markTsCodeFixes.character')) prior = prior.map(item => ({ ...item, description: `${c('markTsCodeFixes.character')} ${item.description}` }))

        return prior
    }
}
