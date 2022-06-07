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
        const syntacicDiagnostics = info.languageService.getSyntacticDiagnostics(fileName)
        // https://github.com/Microsoft/TypeScript/blob/v4.5.5/src/compiler/diagnosticMessages.json#L458
        const findDiagnosticByCode = (codes: number[]) => {
            const errorCode = codes.find(code => {
                return errorCodes.includes(code)
            })
            if (!errorCode) return
            const syntactic = syntacicDiagnostics.find(({ code }) => code === errorCode)
            if (syntactic) {
                return syntactic
            }
            const semantic = semanticDiagnostics.find(({ code }) => code === errorCode)
            if (semantic) {
                return semantic
            }
            return
        }
        const wrapBlockDiagnostics = findDiagnosticByCode([1156, 1157])
        const typeAnnotationDiagnostics = findDiagnosticByCode([8010, 8011])
        if (wrapBlockDiagnostics) {
            prior = [
                ...prior,
                {
                    fixName: 'wrapBlock',
                    description: 'Wrap in block',
                    changes: [
                        {
                            fileName,
                            textChanges: [
                                { span: { start: wrapBlockDiagnostics.start!, length: 0 }, newText: '{' },
                                { span: { start: wrapBlockDiagnostics.start! + wrapBlockDiagnostics.length!, length: 0 }, newText: '}' },
                            ],
                        },
                    ],
                },
            ]
        }
        if (typeAnnotationDiagnostics) {
            prior = [
                ...prior,
                {
                    fixName: 'removeTypeAnnotation',
                    description: 'Remove type annotation',
                    changes: [
                        {
                            fileName,
                            textChanges: [
                                { span: { start: typeAnnotationDiagnostics.start! - 2, length: typeAnnotationDiagnostics.length! + 2 }, newText: '' },
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
