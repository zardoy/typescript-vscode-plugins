import type tslib from 'typescript/lib/tsserverlibrary'
import { findChildContainingPosition, findChildContainingPositionMaxDepth } from './utils'

export const isGoodPositionBuiltinMethodCompletion = (ts: typeof tslib, sourceFile: tslib.SourceFile, position: number) => {
    const importClauseCandidate = findChildContainingPositionMaxDepth(ts, sourceFile, position, 3)
    if (importClauseCandidate && ts.isImportClause(importClauseCandidate)) return false
    const textBeforePos = sourceFile.getFullText().slice(position - 1, position)
    let currentNode = findChildContainingPosition(ts, sourceFile, textBeforePos === ':' ? position - 1 : position)
    if (currentNode) {
        // const obj = { method() {}, arrow: () => {} }
        // type A = typeof obj["|"]
        if (ts.isStringLiteralLike(currentNode)) return false
        if (ts.isIdentifier(currentNode)) currentNode = currentNode.parent
        if (ts.isJsxSelfClosingElement(currentNode) || ts.isJsxOpeningElement(currentNode)) return false
        if (ts.isShorthandPropertyAssignment(currentNode)) currentNode = currentNode.parent
        if (ts.isObjectBindingPattern(currentNode) || ts.isObjectLiteralExpression(currentNode)) return false
    }
    return true
}

export const isGoodPositionMethodCompletion = (
    ts: typeof tslib,
    fileName: string,
    sourceFile: tslib.SourceFile,
    position: number,
    languageService: tslib.LanguageService,
) => {
    if (!isGoodPositionBuiltinMethodCompletion(ts, sourceFile, position)) return false
    // const { kind, displayParts } = languageService.getQuickInfoAtPosition(fileName, position) ?? {}
    // console.log('kind', kind, displayParts?.map(({ text }) => text).join(''))
    // switch (kind) {
    //     case 'var':
    //     case 'let':
    //     case 'const':
    //     case 'alias':
    //         return false
    // }
    // TODO check for brace here
    return true
}
