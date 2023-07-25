import { pipe, groupBy, map } from 'lodash/fp'
import { CodeAction } from '../getCodeActions'
import extractType from '../../utils/extractType'

export default {
    id: 'renameParameterToNameFromType',
    name: 'Rename Parameter to Name from Type',
    kind: 'refactor.rewrite.renameParameterToNameFromType',
    tryToApply(sourceFile, position, range, node, formatOptions, languageService) {
        if (!node || !position) return
        if (!ts.isIdentifier(node) || !ts.isParameter(node.parent) || !ts.isFunctionLike(node.parent.parent)) return

        const functionParameters = node.parent.parent.parameters
        const parameterIndex = functionParameters.indexOf(node.parent)

        const functionDecl = node.parent.parent.parent
        const typeChecker = languageService.getProgram()!.getTypeChecker()
        const type = extractType(typeChecker, functionDecl)

        const typeSignatureParams = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)[0]?.parameters
        if (!typeSignatureParams) return

        const paramName = node.getText()
        const typeParamName = typeSignatureParams[parameterIndex]!.name
        if (paramName === typeParamName) return
        if (!formatOptions) return true

        const renameLocations = languageService.findRenameLocations(sourceFile.fileName, position, false, false, {})
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
