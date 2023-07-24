import { pipe, groupBy, map } from 'lodash/fp'
import { CodeAction } from '../getCodeActions'

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

        const renameLocations = languageService.findRenameLocations(sourceFile.fileName, position, false, false, {
            providePrefixAndSuffixTextForRename: false,
        })
        if (!renameLocations) return

        const extractFileName = ({ fileName }: ts.RenameLocation) => fileName
        const edits = pipe(
            groupBy(extractFileName),
            Object.entries,
            map(
                ([fileName, changes]): ts.FileTextChanges => ({
                    fileName,
                    textChanges: changes.map(
                        ({ textSpan }): ts.TextChange => ({
                            newText: typeParamName,
                            span: textSpan,
                        }),
                    ),
                }),
            ),
        )(renameLocations)

        return {
            edits,
        }
    },
} satisfies CodeAction
