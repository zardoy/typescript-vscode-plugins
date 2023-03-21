import { GetConfig } from '../types'
import { findChildContainingExactPosition } from '../utils'

export default (
    fileName: string,
    refactorName: string,
    actionName: string,
    languageService: ts.LanguageService,
    c: GetConfig,
    prior: ts.RefactorEditInfo,
): ts.RefactorEditInfo | undefined => {
    if (actionName === 'Extract to typedef') return
    const extractToInterface = actionName === 'Extract to interface'
    if (c('codeActions.extractTypeInferName') && (actionName === 'Extract to type alias' || extractToInterface)) {
        const changeFirstEdit = (oldText: string, newTypeName: string) => {
            const startMarker = extractToInterface ? 'interface ' : 'type '
            const endMarker = extractToInterface ? ' {' : ' = '
            return oldText.slice(0, oldText.indexOf(startMarker) + startMarker.length) + newTypeName + oldText.slice(oldText.indexOf(endMarker))
        }

        const fileEdit = prior.edits[0]!
        const { textChanges } = fileEdit

        const sourceFile = languageService.getProgram()!.getSourceFile(fileName)!
        let node = findChildContainingExactPosition(sourceFile, textChanges[1]!.span.start - 1)
        if (!node) return
        if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) node = node.parent
        if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isPropertyAssignment(node) || ts.isPropertySignature(node)) {
            const isWithinType = ts.isPropertySignature(node)
            if (ts.isIdentifier(node.name)) {
                const identifierName = node.name.text
                if (!identifierName) return
                let typeName = identifierName[0]!.toUpperCase() + identifierName.slice(1)
                const namePatternRaw = c('codeActions.extractTypeInferNamePattern')
                const namePatternSelected = typeof namePatternRaw === 'object' ? namePatternRaw[extractToInterface ? 'interface' : 'typeAlias'] : namePatternRaw
                // apply name pattern to type name
                typeName = tsFull.getUniqueName(namePatternSelected.replaceAll('{{name}}', typeName), sourceFile as FullSourceFile)
                const newFileEdit: ts.FileTextChanges = {
                    fileName,
                    textChanges: textChanges.map((textChange, i) => {
                        if (i === 0) return { ...textChange, newText: changeFirstEdit(textChange.newText, typeName) }
                        /* if (i === 1) */ return { ...textChange, newText: typeName }
                    }),
                }
                return {
                    edits: [newFileEdit],
                    renameFilename: fileName,
                    renameLocation: tsFull.getRenameLocation([newFileEdit], fileName, typeName, /*preferLastLocation*/ false),
                }
            }
        }
        return prior
    }
}
