import { GetConfig } from './types'
import { getCancellationToken } from './utils'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, c: GetConfig, languageServiceHost: ts.LanguageServiceHost) => {
    proxy.getNavigateToItems = (searchValue, maxResultCount, fileName, excludeDtsFiles) => {
        const workspaceSymbolSearchExcludePatterns = c('workspaceSymbolSearchExcludePatterns')
        if (workspaceSymbolSearchExcludePatterns.length === 0) {
            return languageService.getNavigateToItems(searchValue, maxResultCount, fileName, excludeDtsFiles)
        }

        const program = languageService.getProgram()!

        let sourceFiles = fileName ? [program.getSourceFile(fileName)!] : program.getSourceFiles()
        if (!fileName) {
            const excludes = tsFull.getRegularExpressionForWildcard(workspaceSymbolSearchExcludePatterns, '', 'exclude')?.slice(1)
            if (excludes) {
                const re = new RegExp(excludes)
                sourceFiles = sourceFiles.filter(x => !re.test(x.fileName))
            }
        }
        return tsFull.NavigateTo.getNavigateToItems(
            sourceFiles as any,
            program.getTypeChecker() as any,
            getCancellationToken(languageServiceHost),
            searchValue,
            maxResultCount,
            excludeDtsFiles ?? false,
        )
    }
}
