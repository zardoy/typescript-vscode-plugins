import { pipe, groupBy, map } from 'lodash/fp'
import { compact } from 'lodash'
import { CodeAction } from '../getCodeActions'
import extractType from '../../utils/extractType'

const getEdits = (
    fileName: string,
    position: number,
    parameterName: string,
    parameterIndex: number,
    functionDeclaration: ts.Node,
    languageService: ts.LanguageService,
): ts.FileTextChanges[] | undefined => {
    const typeChecker = languageService.getProgram()!.getTypeChecker()
    const type = extractType(typeChecker, functionDeclaration)

    const typeSignatureParams = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)[0]?.parameters
    if (!typeSignatureParams) return

    const typeParamName = typeSignatureParams[parameterIndex]!.name
    if (parameterName === typeParamName) return

    const renameLocations = languageService.findRenameLocations(fileName, position, false, false, {})
    if (!renameLocations) return

    const extractFileName = ({ fileName }: ts.RenameLocation) => fileName

    return pipe(
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
}
export const renameParameterToNameFromType = {
    id: 'renameParameterToNameFromType',
    name: 'Rename Parameter to Name from Type',
    kind: 'refactor.rewrite.renameParameterToNameFromType',
    tryToApply(sourceFile, position, range, node, formatOptions, languageService) {
        if (!node || !position) return
        const functionSignature = node.parent.parent
        if (!ts.isIdentifier(node) || !ts.isParameter(node.parent) || !ts.isFunctionLike(functionSignature)) return

        if (!formatOptions) return true

        const { parent: functionDecl, parameters: functionParameters } = functionSignature
        const parameterIndex = functionParameters.indexOf(node.parent)
        const parameterName = functionParameters[parameterIndex]!.name.getText()

        const edits = compact(getEdits(sourceFile.fileName, position, parameterName, parameterIndex, functionDecl, languageService))
        return {
            edits,
        }
    },
} satisfies CodeAction

export const renameAllParametersToNameFromType = {
    id: 'renameAllParametersToNameFromType',
    name: 'Rename All Parameters to Name from Type',
    kind: 'refactor.rewrite.renameAllParametersToNameFromType',
    tryToApply(sourceFile, position, range, node, formatOptions, languageService) {
        if (!node || !position) return
        const functionSignature = node.parent.parent
        if (!ts.isIdentifier(node) || !ts.isParameter(node.parent) || !ts.isFunctionLike(functionSignature)) return
        if (!formatOptions) return true

        const { parent: functionDecl, parameters: functionParameters } = functionSignature

        const edits = compact(
            functionParameters.flatMap((param, index) => {
                return getEdits(sourceFile.fileName, param.end, param.getText(), index, functionDecl, languageService)
            }),
        )
        return {
            edits,
        }
    },
} satisfies CodeAction
