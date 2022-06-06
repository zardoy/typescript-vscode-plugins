import type tslib from 'typescript/lib/tsserverlibrary'
import { GetConfig } from './types'

export default (proxy: tslib.LanguageService, info: tslib.server.PluginCreateInfo, c: GetConfig) => {
    proxy.getCodeFixesAtPosition = (fileName, start, end, errorCodes, formatOptions, preferences) => {
        let prior = info.languageService.getCodeFixesAtPosition(fileName, start, end, errorCodes, formatOptions, preferences)
        console.log(
            'prior',
            prior.map(({ fixName, fixAllDescription, fixId }) => JSON.stringify({ fixId, fixAllDescription, fixName })),
        )
        // const scriptSnapshot = info.project.getScriptSnapshot(fileName)
        const semanticDiagnostics = info.languageService.getSemanticDiagnostics(fileName)
        const diagnostics = info.languageService.getSyntacticDiagnostics(fileName)

        // https://github.com/Microsoft/TypeScript/blob/v4.5.5/src/compiler/diagnosticMessages.json#L458
        // const findDiagnosticByCode = (codes: string[]) => {
        //     errorCodes.includes(code)
        // }
        const wrapBlockCodes = [1156, 1157].find(code => errorCodes.includes(code)   )
        const typeAnnotationCode = [8010, 8011].find(code => errorCodes.includes(code))
        if (wrapBlockCodes) {
            const diagnostic = diagnostics.find(({ code }) => code === wrapBlockCodes)!
            prior = [
                ...prior,
                {
                    fixName: 'wrapBlock',
                    description: 'Wrap in block',
                    changes: [
                        {
                            fileName,
                            textChanges: [
                                { span: { start: diagnostic.start!, length: 0 }, newText: '{' },
                                { span: { start: diagnostic.start! + diagnostic.length!, length: 0 }, newText: '}' },
                            ],
                        },
                    ],
                },
            ]
        }
        if (typeAnnotationCode) {
            const diagnostic = diagnostics.find(({ code }) => code === typeAnnotationCode)!
            console.log('diagnostic', diagnostic)
            prior = [
                ...prior,
                {
                    fixName: 'removeTypeAnnotation',
                    description: 'Remove type annotation',
                    changes: [
                        {
                            fileName,
                            textChanges: [{ span: { start: diagnostic.start! - 2, length: diagnostic.length! + 2 }, newText: '' }],
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
