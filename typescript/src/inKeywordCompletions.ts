import type tslib from 'typescript/lib/tsserverlibrary'

export default (
    position: number,
    fileName: string,
    node: tslib.Node | undefined,
    sourceFile: tslib.SourceFile,
    program: tslib.Program,
    languageService: tslib.LanguageService,
    ts: typeof tslib,
) => {
    if (!node) return
    function isBinaryExpression(node: ts.Node): node is ts.BinaryExpression {
        return node.kind === ts.SyntaxKind.BinaryExpression
    }
    const typeChecker = program.getTypeChecker()
    // TODO info diagnostic if used that doesn't exist
    if (
        ts.isStringLiteralLike(node) &&
        isBinaryExpression(node.parent) &&
        node.parent.left === node &&
        node.parent.operatorToken.kind === ts.SyntaxKind.InKeyword
    ) {
        const quote = node.getText()[0]!
        const type = typeChecker.getTypeAtLocation(node.parent.right)
        const suggestions: Record<
            string,
            {
                insertText: string
                usingDisplayIndexes: number[]
                documentations: string[]
            }
        > = {}
        const unitedTypes = type.isUnion() ? type.types : [type]
        for (let [typeIndex, localType] of unitedTypes.entries()) {
            // TODO set deprecated tag
            for (let prop of localType.getProperties()) {
                const { name } = prop
                if (!suggestions[name])
                    suggestions[name] = {
                        insertText: prop.name.replace(quote, `\\${quote}`),
                        usingDisplayIndexes: [],
                        documentations: [],
                    }
                suggestions[name]!.usingDisplayIndexes.push(typeIndex + 1)
                // const doc = prop.getDocumentationComment(typeChecker)
                const declaration = prop.getDeclarations()?.[0]
                suggestions[name]!.documentations.push(
                    `${typeIndex + 1}: ${declaration && typeChecker.typeToString(typeChecker.getTypeAtLocation(declaration))}`,
                )
            }
        }
        const docPerCompletion: Record<string, string> = {}
        const completions: ts.CompletionEntry[] = Object.entries(suggestions)
            .map(([originaName, { insertText, usingDisplayIndexes, documentations }], i) => {
                const name = unitedTypes.length > 1 && usingDisplayIndexes.length === 1 ? `☆${originaName}` : originaName
                docPerCompletion[name] = documentations.join('\n\n')
                return {
                    // ⚀ ⚁ ⚂ ⚃ ⚄ ⚅
                    name: name,
                    kind: ts.ScriptElementKind.string,
                    insertText,
                    sourceDisplay: [{ kind: 'text', text: usingDisplayIndexes.join(', ') }],
                    sortText: `${usingDisplayIndexes.length}_${i}`,
                }
            })
            .sort((a, b) => a.sortText.localeCompare(b.sortText))
        return {
            completions,
            // make lazy?
            docPerCompletion,
        }
    }
    return
}
