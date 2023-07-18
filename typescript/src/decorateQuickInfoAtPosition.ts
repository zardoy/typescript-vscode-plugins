import { GetConfig } from './types'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, languageServiceHost: ts.LanguageServiceHost, c: GetConfig) => {
    proxy.getQuickInfoAtPosition = (...args) => {
        const [fileName, position] = args
        const prior = languageService.getQuickInfoAtPosition(...args)
        if (!prior) return
        return prior
    }
}
