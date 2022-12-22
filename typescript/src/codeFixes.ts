import addMissingProperties from './codeFixes/addMissingProperties'
import { GetConfig } from './types'
import { findChildContainingPosition, getIndentFromPos } from './utils'

// codeFixes that I managed to put in files
const externalCodeFixes = [addMissingProperties]

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, c: GetConfig) => {
    proxy.getCodeFixesAtPosition = (fileName, start, end, errorCodes, formatOptions, preferences) => {
        let prior = languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences)
        // #region fix builtin codefixes/refactorings
        prior.forEach(fix => {
            if (fix.fixName === 'fixConvertConstToLet') {
                const { start, length } = fix.changes[0]!.textChanges[0]!.span
                const fixedLength = 'const'.length as 5
                fix.changes[0]!.textChanges[0]!.span.start = start + length - fixedLength
                fix.changes[0]!.textChanges[0]!.span.length = fixedLength
            }
            // don't let it trigger on ctrl+s https://github.com/microsoft/vscode/blob/e8a3071ea4344d9d48ef8a4df2c097372b0c5161/extensions/typescript-language-features/src/languageFeatures/fixAll.ts#L142
            if (fix.fixName === 'fixAwaitInSyncFunction') {
                fix.fixName = 'fixedFixAwaitInSyncFunction'
            }
            return fix
        })
        // #endregion

        const semanticDiagnostics = languageService.getSemanticDiagnostics(fileName)
        const syntacicDiagnostics = languageService.getSyntacticDiagnostics(fileName)

        // https://github.com/Microsoft/TypeScript/blob/v4.5.5/src/compiler/diagnosticMessages.json#L458
        const findDiagnosticByCode = (codes: number[]) => {
            const errorCode = codes.find(code => errorCodes.includes(code))
            if (!errorCode) return
            const diagnosticPredicate = ({ code, start: localStart }) => code === errorCode && localStart === start
            return syntacicDiagnostics.find(diagnosticPredicate) || semanticDiagnostics.find(diagnosticPredicate)
        }

        const wrapBlockDiagnostics = findDiagnosticByCode([1156, 1157])
        if (wrapBlockDiagnostics) {
            const program = languageService.getProgram()
            const sourceFile = program!.getSourceFile(fileName)!
            const startIndent = getIndentFromPos(ts, sourceFile, end)
            prior = [
                ...prior,
                {
                    fixName: 'wrapBlock',
                    description: 'Wrap in block',
                    changes: [
                        {
                            fileName,
                            textChanges: [
                                { span: { start: wrapBlockDiagnostics.start!, length: 0 }, newText: `{\n${startIndent}\t` },
                                { span: { start: wrapBlockDiagnostics.start! + wrapBlockDiagnostics.length!, length: 0 }, newText: `\n${startIndent}}` },
                            ],
                        },
                    ],
                },
            ]
        }

        const sourceFile = languageService.getProgram()?.getSourceFile(fileName)!
        for (let codeFix of externalCodeFixes) {
            const diagnostic = findDiagnosticByCode(codeFix.codes)
            if (!diagnostic) continue
            const startNode = findChildContainingPosition(ts, sourceFile, diagnostic.start!)!
            const suggestedCodeFix = codeFix.provideFix(diagnostic, startNode, sourceFile, languageService)
            if (!suggestedCodeFix) continue
            prior = [suggestedCodeFix, ...prior]
        }

        // TODO add our ids to enum of this setting
        if (c('removeCodeFixes.enable')) {
            const toRemove = c('removeCodeFixes.codefixes')
            prior = prior.filter(({ fixName }) => !toRemove.includes(fixName as any))
        }

        if (c('markTsCodeFixes.character')) prior = prior.map(item => ({ ...item, description: `${c('markTsCodeFixes.character')} ${item.description}` }))

        return prior
    }
}
