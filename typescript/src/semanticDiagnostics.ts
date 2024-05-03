import { GetConfig } from './types'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, languageServiceHost: ts.LanguageServiceHost, c: GetConfig) => {
    proxy.getSemanticDiagnostics = (fileName, ...props) => {
        let prior = languageService.getSemanticDiagnostics(fileName, ...props)
        if (c('supportTsDiagnosticDisableComment')) {
            const scriptSnapshot = languageServiceHost.getScriptSnapshot(fileName)!
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
