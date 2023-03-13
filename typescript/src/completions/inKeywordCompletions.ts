import { sharedCompletionContext } from './sharedContext'
import { buildStringCompletion } from '../utils'

export default () => {
    const { node, program } = sharedCompletionContext
    if (!node) return
    function isBinaryExpression(node: ts.Node): node is ts.BinaryExpression {
        return node.kind === ts.SyntaxKind.BinaryExpression
    }
    const typeChecker = program.getTypeChecker()
    if (
        ts.isStringLiteralLike(node) &&
        isBinaryExpression(node.parent) &&
        node.parent.left === node &&
        node.parent.operatorToken.kind === ts.SyntaxKind.InKeyword
    ) {
        const quote = node.getText()[0]!
        const type = typeChecker.getTypeAtLocation(node.parent.right)
        const suggestionsData = new Map<
            string,
            {
                insertText: string
                usingDisplayIndexes: number[]
                documentations: string[]
            }
        >()
        const types = type.isUnion() ? type.types : [type]
        for (let [typeIndex, typeEntry] of types.entries()) {
            // improved DX: not breaking other completions as TS would display error anyway
            if (!(typeEntry.flags & ts.TypeFlags.Object)) continue
            for (const prop of typeEntry.getProperties()) {
                const { name } = prop
                if (!suggestionsData.has(name)) {
                    suggestionsData.set(name, {
                        insertText: prop.name.replace(quote, `\\${quote}`),
                        usingDisplayIndexes: [],
                        documentations: [],
                    })
                }
                suggestionsData.get(name)!.usingDisplayIndexes.push(typeIndex + 1)
                // const doc = prop.getDocumentationComment(typeChecker)
                const declaration = prop.getDeclarations()?.[0]
                suggestionsData
                    .get(name)!
                    .documentations.push(`${typeIndex + 1}: ${declaration && typeChecker.typeToString(typeChecker.getTypeAtLocation(declaration))}`)
            }
        }
        const docPerCompletion: Record<string, string> = {}
        const maxUsingDisplayIndex = Math.max(...[...suggestionsData.entries()].map(([, { usingDisplayIndexes }]) => usingDisplayIndexes.length))
        const completions: ts.CompletionEntry[] = [...suggestionsData.entries()]
            .map(([originaName, { insertText, usingDisplayIndexes, documentations }], i) => {
                const name = types.length > 1 && usingDisplayIndexes.length === 1 ? `☆${originaName}` : originaName
                docPerCompletion[name] = documentations.join('\n\n')
                return buildStringCompletion(node, {
                    // ⚀ ⚁ ⚂ ⚃ ⚄ ⚅
                    name,
                    labelDetails: {
                        description: usingDisplayIndexes.join(', '),
                    },
                    insertText,
                    sortText: `${maxUsingDisplayIndex - usingDisplayIndexes.length}_${i}`,
                })
            })
            .sort((a, b) => a.sortText.localeCompare(b.sortText))
        return {
            completions,
            docPerCompletion,
        }
    }
    return
}
