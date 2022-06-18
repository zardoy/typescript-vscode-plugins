import type tslib from 'typescript/lib/tsserverlibrary'

export default (
    position: number,
    fileName: string,
    scriptSnapshot: tslib.IScriptSnapshot,
    sourceFile: tslib.SourceFile,
    languageService: tslib.LanguageService,
): boolean => {
    const { character } = languageService.toLineColumnOffset!(fileName, position)
    const textBeforePositionLine = scriptSnapshot?.getText(position - character, position)
    const textAfterPositionLine = scriptSnapshot?.getText(position, sourceFile.getLineEndOfPosition(position))
    if (textBeforePositionLine.trimStart() === 'import ' && textAfterPositionLine.trimStart().startsWith('from')) return true
    return false
}
