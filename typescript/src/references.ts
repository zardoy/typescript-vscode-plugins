import { GetConfig } from './types'
import { findChildContainingPositionMaxDepth, approveCast, findChildContainingExactPosition, matchParents } from './utils'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, c: GetConfig) => {
    proxy.findReferences = (fileName, position) => {
        let prior = languageService.findReferences(fileName, position)
        if (!prior) return
        const program = languageService.getProgram()!
        if (c('removeDefinitionFromReferences')) {
            const sourceFile = program.getSourceFile(fileName)
            const node = findChildContainingExactPosition(sourceFile!, position)
            let filterDefs = true
            if (
                node &&
                node.flags & ts.NodeFlags.JavaScriptFile &&
                matchParents(node, ['Identifier', 'PropertyAccessExpression'])?.expression.kind === ts.SyntaxKind.ThisKeyword
            ) {
                // https://github.com/zardoy/typescript-vscode-plugins/issues/165
                filterDefs = false
            }

            if (filterDefs) {
                prior = prior.map(({ references, ...other }) => ({
                    ...other,
                    references: references.filter(({ isDefinition, textSpan, fileName }) => {
                        return !isDefinition
                    }),
                }))
            }
        }
        if (c('removeImportsFromReferences')) {
            const refCountPerFileName: Record<
                string,
                {
                    total: number
                    current: number
                }
            > = {}
            const allReferences = prior.flatMap(({ references }) => references)
            for (const { fileName } of allReferences) {
                refCountPerFileName[fileName] ??= {
                    total: 0,
                    current: 0,
                }
                refCountPerFileName[fileName]!.total++
            }
            prior = prior.map(({ references, ...other }) => {
                return {
                    ...other,
                    references: references.filter(({ fileName, textSpan }) => {
                        const refsCount = refCountPerFileName[fileName]!
                        // doesn't make sense to handle case where it gets imports twice
                        if (refsCount.total <= 1 || refsCount.current !== 0) return true
                        refsCount.current++
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
        if (c('skipNodeModulesReferences') && !fileName.includes('node_modules')) {
            prior = prior.map(({ references, ...other }) => ({
                ...other,
                references: references.filter(({ fileName }) => {
                    const nodeModulesFile = fileName.includes('/node_modules/')
                    return !nodeModulesFile
                }),
            }))
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
