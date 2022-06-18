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
    const textAfterPosition = scriptSnapshot?.getText(position, sourceFile.getLineEndOfPosition(position))
    const newLineIndex = textAfterPosition.indexOf('\n')
    const textAfterPositionLine = newLineIndex === -1 ? textAfterPosition : textAfterPosition.slice(0, newLineIndex)
    if (textBeforePositionLine.trimStart() === 'import ' && textAfterPositionLine.trimStart().startsWith('from')) return true
    return false
}
