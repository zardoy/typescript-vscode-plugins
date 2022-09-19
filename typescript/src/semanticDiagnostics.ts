import type tslib from 'typescript/lib/tsserverlibrary'
import { GetConfig } from './types'

export default (proxy: ts.LanguageService, info: ts.server.PluginCreateInfo, c: GetConfig) => {
    proxy.getSemanticDiagnostics = fileName => {
        let prior = info.languageService.getSemanticDiagnostics(fileName)
        if (c('supportTsDiagnosticDisableComment')) {
            const scriptSnapshot = info.project.getScriptSnapshot(fileName)!
            const firstLine = scriptSnapshot.getText(0, scriptSnapshot.getLength()).split(/\r?\n/)[0]!
            if (firstLine.startsWith('//')) {
                const match = firstLine.match(/@ts-diagnostic-disable ((\d+, )*(\d+))/)
                if (match) {
                    const codesToDisable = match[1]!.split(', ').map(Number)
                    prior = prior.filter(({ code }) => !codesToDisable.includes(code))
                }
            }
        }
        return prior
    }
}
