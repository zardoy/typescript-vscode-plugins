import { uniq } from 'rambda'
import { findChildContainingExactPosition, getChangesTracker, getPositionHighlights, isValidInitializerForDestructure, makeUniqueName } from '../../../utils'

export default (node: ts.Node, sourceFile: ts.SourceFile, formatOptions: ts.FormatCodeSettings | undefined, languageService: ts.LanguageService) => {
    const isValidInitializer = ts.isVariableDeclaration(node.parent) && node.parent.initializer && isValidInitializerForDestructure(node.parent.initializer)

    // Make sure it only triggers on the destructuring object or parameter
    if (!ts.isIdentifier(node) || !(isValidInitializer || ts.isParameter(node.parent))) return

    const highlightPositions = getPositionHighlights(node.getStart(), sourceFile, languageService)

    if (!highlightPositions) return
    const tracker = getChangesTracker(formatOptions ?? {})

    const propertyNames: Array<{ initial: string; unique: string | undefined }> = []
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

            propertyNames.push({ initial: accessorName, unique: uniqueName === accessorName ? undefined : uniqueName })
            const range =
                ts.isPropertyAssignment(highlightedNode.parent.parent) && highlightedNode.parent.parent.name.getText() === accessorName
                    ? {
                          pos: highlightedNode.parent.parent.pos + highlightedNode.parent.parent.getLeadingTriviaWidth(),
                          end: highlightedNode.parent.parent.end,
                      }
                    : { pos, end: highlightedNode.parent.end }

            tracker.replaceRangeWithText(sourceFile, range, uniqueName)
            continue
        }

        if (ts.isIdentifier(highlightedNode) && (ts.isVariableDeclaration(highlightedNode.parent) || ts.isParameter(highlightedNode.parent))) {
            // Already met a target node - abort as we encountered direct use of the potential destructured variable
            if (nodeToReplaceWithBindingPattern) return
            nodeToReplaceWithBindingPattern = highlightedNode
            continue
        }
    }

    if (!nodeToReplaceWithBindingPattern || propertyNames.length === 0) return

    const bindings = uniq(propertyNames).map(({ initial, unique }) => {
        return ts.factory.createBindingElement(undefined, unique ? initial : undefined, unique ?? initial)
    })

    const bindingPattern = ts.factory.createObjectBindingPattern(bindings)
    const { pos, end } = nodeToReplaceWithBindingPattern

    tracker.replaceRange(
        sourceFile,
        {
            pos: pos + nodeToReplaceWithBindingPattern.getLeadingTriviaWidth(),
            end,
        },
        bindingPattern,
    )

    const changes = tracker.getChanges()
    if (!changes) return undefined
    return {
        edits: [
            {
                fileName: sourceFile.fileName,
                textChanges: changes[0]!.textChanges,
            },
        ],
    }
}
