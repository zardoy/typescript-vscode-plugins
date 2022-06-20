import type tslib from 'typescript/lib/tsserverlibrary'

export default (
    position: number,
    fileName: string,
    scriptSnapshot: tslib.IScriptSnapshot,
    sourceFile: tslib.SourceFile,
    languageService: tslib.LanguageService,
    ts: typeof tslib,
    program: tslib.Program,
    node?: tslib.Node,
): boolean => {
    if (node) {
        const typeChecker = program.getTypeChecker()
        // TODO check not any!
        if (ts.isObjectLiteralExpression(node)) {
            const type = typeChecker.getTypeAtLocation(node)
            if (type.getProperties().length === 0) {
                return true
            }
        }
    }
    const { character } = languageService.toLineColumnOffset!(fileName, position)
    const textBeforePositionLine = scriptSnapshot?.getText(position - character, position)
    const textAfterPositionLine = scriptSnapshot?.getText(position, sourceFile.getLineEndOfPosition(position))
    if (textBeforePositionLine.trimStart() === 'import ' && textAfterPositionLine.trimStart().startsWith('from')) return true
    return false
}
