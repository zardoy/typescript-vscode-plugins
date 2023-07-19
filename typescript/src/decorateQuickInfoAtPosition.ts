import { GetConfig } from './types'
import { findChildContainingExactPosition } from './utils'
import getImportPath from './utils/getImportPath'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, languageServiceHost: ts.LanguageServiceHost, c: GetConfig) => {
    proxy.getQuickInfoAtPosition = (...args) => {
        const [fileName, position] = args
        const prior = languageService.getQuickInfoAtPosition(...args)
        if (!prior) return
        const program = languageService.getProgram()!
        const sourceFile = program.getSourceFile(fileName)!

        if (c('suggestions.displayImportedInfo') !== 'disable') {
            const node = findChildContainingExactPosition(sourceFile, position)
            const possiblyImportKeywords = prior.displayParts?.at(-3)
            if (possiblyImportKeywords?.text === 'import' && node) {
                const symbolAtLocation = program.getTypeChecker().getSymbolAtLocation(node)
                if (symbolAtLocation) {
                    const result = getImportPath(symbolAtLocation)
                    if (result) {
                        const { quotedPath: importPath, importKind } = result

                        prior.displayParts!.at(-3)!.text =
                            {
                                [ts.SyntaxKind.NamespaceImport]: 'import * as',
                                [ts.SyntaxKind.NamedImports]: 'import {',
                            }[importKind] ?? possiblyImportKeywords.text

                        prior.displayParts = [
                            ...(prior.displayParts || []),
                            { kind: 'text', text: `${importKind === ts.SyntaxKind.NamedImports ? ' }' : ''} from ${importPath}` },
                        ]
                    }
                }
            }
        }
        return prior
    }
}
