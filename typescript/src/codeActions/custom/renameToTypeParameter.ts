import { CodeAction } from '../getCodeActions'
import { getChangesTracker } from '../../utils'

export default {
    id: 'renameToTypeParameter',
    name: 'Rename to Type Parameter',
    kind: 'refactor.rewrite.renameToTypeParameter',
    tryToApply(sourceFile, position, range, node, formatOptions, languageService) {
        if (!node || !position) return
        if (!ts.isIdentifier(node) || !ts.isParameter(node.parent) || !ts.isFunctionLike(node.parent.parent)) return

        const functionParameters = node.parent.parent.parameters
        const parameterIndex = functionParameters.indexOf(node.parent)

        const functionDecl = node.parent.parent.parent
        const typeChecker = languageService.getProgram()!.getTypeChecker()
        const typeAtLocation = typeChecker.getTypeAtLocation(functionDecl)

        const typeDecl = typeAtLocation.getSymbol()?.declarations?.[0]
        if (!typeDecl || !ts.isFunctionLike(typeDecl)) return
        const paramName = node.getText()
        const typeParamName = typeDecl.parameters[parameterIndex]!.name.getText()
        if (paramName === typeParamName) return
        if (!formatOptions) return true
        const changesTracker = getChangesTracker({})
        changesTracker.replaceNodeWithText(sourceFile, node, typeParamName)
        return {
            edits: [
                {
                    fileName: sourceFile.fileName,
                    textChanges: changesTracker.getChanges()[0]!.textChanges,
                },
            ],
        }
    },
} satisfies CodeAction
