import type tslib from 'typescript/lib/tsserverlibrary'

export default (position: number, scriptSnapshot: tslib.IScriptSnapshot, sourceFile: tslib.SourceFile): boolean => {
    const { character } = sourceFile.getLineAndCharacterOfPosition(position)
    const textBeforePositionLine = scriptSnapshot?.getText(position - character, position)
    const textAfterPositionLine = scriptSnapshot?.getText(position, sourceFile.getLineEndOfPosition(position))
    if (textBeforePositionLine.trimStart() === 'import ' && textAfterPositionLine.trimStart().startsWith('from')) return true
    return false
}
