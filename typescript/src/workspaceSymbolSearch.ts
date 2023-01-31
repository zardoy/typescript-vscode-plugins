import { GetConfig } from './types'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, c: GetConfig, languageServiceHost: ts.LanguageServiceHost) => {
    proxy.getNavigateToItems = (searchValue, maxResultCount, fileName, excludeDtsFiles) => {
        const workspaceSymbolSearchExcludePatterns = c('workspaceSymbolSearchExcludePatterns')
        if (!workspaceSymbolSearchExcludePatterns.length) {
            return languageService.getNavigateToItems(searchValue, maxResultCount, fileName, excludeDtsFiles)
        }

        const program = languageService.getProgram()!
        const cancellationToken = languageServiceHost.getCompilerHost?.()?.getCancellationToken?.() ?? {
            isCancellationRequested: () => false,
            throwIfCancellationRequested: () => {},
        }
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
            // TODO! use real cancellationToken
            cancellationToken,
            searchValue,
            maxResultCount,
            excludeDtsFiles ?? false,
        )
    }
}
