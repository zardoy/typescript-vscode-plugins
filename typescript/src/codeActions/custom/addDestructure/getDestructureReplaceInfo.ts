import { findChildContainingExactPosition, makeUniqueName } from '../../../utils'

export const getDestructureReplaceInfo = (highlightPositions: number[], node: ts.Node, sourceFile: ts.SourceFile, languageService: ts.LanguageService) => {
    const propertiesToReplace: Array<{ initial: string; unique: string | undefined; range: { pos: number; end: number } }> = []
    let nodeToReplaceWithBindingPattern: ts.Identifier | undefined

    for (const pos of highlightPositions) {
        const highlightedNode = findChildContainingExactPosition(sourceFile, pos)

        if (!highlightedNode) continue

        if (
            ts.isElementAccessExpression(highlightedNode.parent) ||
            ts.isTypeQueryNode(highlightedNode.parent) ||
            (ts.isCallExpression(highlightedNode.parent.parent) && highlightedNode.parent.parent.expression === highlightedNode.parent)
        )
            return

        if (ts.isIdentifier(highlightedNode) && ts.isPropertyAccessExpression(highlightedNode.parent)) {
            const accessorName = highlightedNode.parent.name.getText()

            if (!accessorName) continue

            const uniqueName = makeUniqueName(accessorName, node, languageService, sourceFile)

            const range =
                ts.isPropertyAssignment(highlightedNode.parent.parent) && highlightedNode.parent.parent.name.getText() === accessorName
                    ? {
                          pos: highlightedNode.parent.parent.pos + highlightedNode.parent.parent.getLeadingTriviaWidth(),
                          end: highlightedNode.parent.parent.end,
                      }
                    : { pos, end: highlightedNode.parent.end }

            propertiesToReplace.push({ initial: accessorName, unique: uniqueName === accessorName ? undefined : uniqueName, range })

            continue
        }

        if (ts.isIdentifier(highlightedNode) && (ts.isVariableDeclaration(highlightedNode.parent) || ts.isParameter(highlightedNode.parent))) {
            // Already met a target node - abort as we encountered direct use of the potential destructured variable
            if (nodeToReplaceWithBindingPattern) return
            nodeToReplaceWithBindingPattern = highlightedNode
            continue
        }
    }
    return { propertiesToReplace, nodeToReplaceWithBindingPattern }
}
