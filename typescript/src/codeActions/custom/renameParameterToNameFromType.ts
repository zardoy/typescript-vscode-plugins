import { pipe, groupBy, map, compact } from 'lodash/fp'
import { CodeAction } from '../getCodeActions'
import extractType from '../../utils/extractType'

const getTypeParamName = (parameterIndex: number, functionDeclaration: ts.Node, languageService: ts.LanguageService) => {
    const typeChecker = languageService.getProgram()!.getTypeChecker()
    const type = extractType(typeChecker, functionDeclaration)

    const typeSignatureParams = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)[0]?.parameters
    if (!typeSignatureParams) return

    return typeSignatureParams[parameterIndex]!.name
}

const getEdits = (fileName: string, position: number, newText: string, languageService: ts.LanguageService): ts.FileTextChanges[] | undefined => {
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
                        newText,
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
        const { parent: functionDecl, parameters: functionParameters } = functionSignature

        const parameterIndex = functionParameters.indexOf(node.parent)
        const parameterName = functionParameters[parameterIndex]!.name.getText()
        const typeParamName = getTypeParamName(functionParameters.indexOf(node.parent), functionDecl, languageService)
        if (!typeParamName || typeParamName.startsWith('__') || parameterName === typeParamName) return

        if (!formatOptions) return true

        const edits = compact(getEdits(sourceFile.fileName, position, typeParamName, languageService))
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
        const { parent: functionDecl, parameters: functionParameters } = functionSignature

        const paramsToRename = compact(
            functionParameters.map((functionParameter, index) => {
                const typeParamName = getTypeParamName(index, functionDecl, languageService)
                if (!typeParamName) return
                const isInternal = typeParamName.startsWith('__')
                if (isInternal || functionParameter.getText() === typeParamName) return
                return { param: functionParameter, typeParamName }
            }),
        )
        if (paramsToRename.length < 2) return

        if (!formatOptions) return true

        const edits = compact(
            paramsToRename.flatMap(({ param, typeParamName }) => {
                return getEdits(sourceFile.fileName, param.getStart(), typeParamName, languageService)
            }),
        )
        return {
            edits,
        }
    },
} satisfies CodeAction
