import { GetConfig } from './types'
import { findChildContainingPositionMaxDepth, approveCast } from './utils'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, c: GetConfig) => {
    proxy.findReferences = (fileName, position) => {
        let prior = languageService.findReferences(fileName, position)
        if (!prior) return
        if (c('removeDefinitionFromReferences')) {
            prior = prior.map(({ references, ...other }) => ({
                ...other,
                references: references.filter(({ isDefinition }) => !isDefinition),
            }))
        }
        if (c('removeImportsFromReferences')) {
            const program = languageService.getProgram()!
            const importsCountPerFileName: Record<
                string,
                {
                    all: number
                    cur: number
                }
            > = {}
            const allReferences = prior.flatMap(({ references }) => references)
            allReferences.forEach(({ fileName }) => {
                importsCountPerFileName[fileName] ??= {
                    all: 0,
                    cur: 0,
                }
                importsCountPerFileName[fileName]!.all++
            })
            prior = prior.map(({ references, ...other }) => {
                return {
                    ...other,
                    references: references.filter(({ fileName, textSpan }) => {
                        const importsCount = importsCountPerFileName[fileName]!
                        // doesn't make sense to handle case where it gets imports twice
                        if (importsCount.all <= 1 || importsCount.cur !== 0) return true
                        importsCount.cur++
                        const sourceFile = program.getSourceFile(fileName)
                        if (!sourceFile) return true
                        const end = textSpan.start + textSpan.length
                        let node = findChildContainingPositionMaxDepth(sourceFile, end, 6)
                        if (!node) return true
                        if (ts.isIdentifier(node)) node = node.parent
                        if (
                            approveCast(node, ts.isNamedImports, ts.isImportSpecifier, ts.isImportClause, ts.isImportEqualsDeclaration, ts.isImportDeclaration)
                        ) {
                            return false
                        }
                        return true
                    }),
                }
            })
        }
        return prior
    }

    // Volar 1.0.25 uses it
    proxy.getReferencesAtPosition = (fileName, position) => {
        const references = proxy.findReferences(fileName, position)
        if (!references) return
        return references.flatMap(({ references }) => references)
    }
}
