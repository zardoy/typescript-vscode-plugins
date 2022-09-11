import type tslib from 'typescript/lib/tsserverlibrary'
import { findChildContainingPosition } from './utils'

export const isGoodPositionBuiltinMethodCompletion = (ts: typeof tslib, sourceFile: tslib.SourceFile, position: number) => {
    const importClauseCandidate = findChildContainingPosition(ts, sourceFile, position, 2)
    if (importClauseCandidate?.kind === 266) return false
    const currentNode = findChildContainingPosition(ts, sourceFile, position)
    // const obj = { method() {}, arrow: () => {} }
    // type A = typeof obj["|"]
    if (currentNode && ts.isStringLiteralLike(currentNode)) return false
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
    const { kind } = languageService.getQuickInfoAtPosition(fileName, position) ?? {}
    switch (kind) {
        case 'var':
        case 'let':
        case 'const':
        case 'alias':
            return false
    }
    // TODO check for brace here
    return true
}
