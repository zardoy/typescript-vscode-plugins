import { GetConfig } from '../types'
import { findChildContainingPosition, findChildContainingPositionMaxDepth } from '../utils'

export const isGoodPositionMethodCompletion = (sourceFile: ts.SourceFile, position: number, c: GetConfig) => {
    const importClauseCandidate = findChildContainingPositionMaxDepth(sourceFile, position, 3)
    if (importClauseCandidate && ts.isImportClause(importClauseCandidate)) return false
    const textBeforePos = sourceFile.getFullText().slice(position - 1, position)
    let currentNode = findChildContainingPosition(ts, sourceFile, textBeforePos === ':' ? position - 1 : position)
    if (currentNode) {
        // const obj = { method() {}, arrow: () => {} }
        // type A = typeof obj["|"]
        if (ts.isStringLiteralLike(currentNode)) return false
        if (ts.isNamedExports(currentNode)) return false
        if (ts.isIdentifier(currentNode)) currentNode = currentNode.parent
        if (ts.isExportSpecifier(currentNode)) return false
        if (ts.isJsxSelfClosingElement(currentNode) || ts.isJsxOpeningElement(currentNode)) return false
        if (ts.isBindingElement(currentNode) || ts.isShorthandPropertyAssignment(currentNode)) currentNode = currentNode.parent
        if (ts.isObjectBindingPattern(currentNode) || ts.isObjectLiteralExpression(currentNode)) return false
        if (ts.isJsxAttributes(currentNode) || ts.isJsxAttribute(currentNode)) return false
        if (c('disableMethodSnippets.jsxAttributes') && ts.isJsxExpression(currentNode)) return false
    }
    return true
}
