import { findChildContainingExactPosition, getChangesTracker } from '../../utils'
import { CodeAction } from '../getCodeActions'

const isFinalChainElement = (node: ts.Node) =>
    ts.isThisTypeNode(node) || ts.isIdentifier(node) || ts.isParenthesizedExpression(node) || ts.isObjectLiteralExpression(node) || ts.isNewExpression(node)

const isValidChainElement = (node: ts.Node) =>
    (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node) || ts.isNonNullExpression(node)) &&
    !ts.isOptionalChain(node)

const verifyMatch = (match: ts.Expression) => {
    let currentChainElement = match

    while (!isFinalChainElement(currentChainElement)) {
        if (!isValidChainElement(currentChainElement)) {
            return false
        }
        type PossibleChainElement =
            | ts.PropertyAccessExpression
            | ts.CallExpression
            | ts.ElementAccessExpression
            | ts.NonNullExpression
            | ts.ParenthesizedExpression
            | ts.AwaitExpression

        const chainElement = currentChainElement as PossibleChainElement

        currentChainElement = chainElement.expression
    }

    return true
}

const isPositionMatchesInitializer = (pos: number, initializer: ts.Expression) => {
    return pos >= initializer.getStart() && pos <= initializer.getEnd()
}

const createDestructuredDeclaration = (declaration: ts.VariableDeclaration, pos: number) => {
    const { initializer, type, name: declarationName } = declaration

    if (!initializer || !isPositionMatchesInitializer(pos, initializer) || !verifyMatch(initializer) || !ts.isPropertyAccessExpression(initializer)) return

    const propertyName = initializer.name.text
    const { factory } = ts

    const bindingElement = factory.createBindingElement(
        undefined,
        declarationName.getText() === propertyName ? undefined : propertyName,
        declarationName.getText(),
    )

    return factory.createVariableDeclaration(
        factory.createObjectBindingPattern([bindingElement]),
        undefined,
        type ? factory.createTypeLiteralNode([factory.createPropertySignature(undefined, factory.createIdentifier(propertyName), undefined, type)]) : undefined,
        initializer.expression,
    )
}
export default {
    id: 'addDestruct',
    name: 'Add Destruct',
    kind: 'refactor.rewrite.add-destruct',
    tryToApply(sourceFile, position, _range, node, formatOptions, languageService) {
        if (!node || !position) return
        const initialDeclaration = ts.findAncestor(node, n => ts.isVariableDeclaration(n)) as ts.VariableDeclaration | undefined

        if (initialDeclaration && !ts.isObjectBindingPattern(initialDeclaration.name)) {
            const tracker = getChangesTracker(formatOptions ?? {})
            const createdDeclaration = createDestructuredDeclaration(initialDeclaration, position)
            if (!createdDeclaration) return

            tracker.replaceNode(sourceFile, initialDeclaration, createdDeclaration)

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

        if (!ts.isIdentifier(node) && !(ts.isPropertyAccessExpression(node.parent) || ts.isParameter(node.parent))) return

        const highlights = languageService.getDocumentHighlights(sourceFile.fileName, node.getStart(), [sourceFile.fileName])

        if (!highlights) return

        const highlightPositions = highlights.flatMap(({ highlightSpans }) => highlightSpans.map(({ textSpan }) => textSpan.start))

        const tracker = getChangesTracker(formatOptions ?? {})

        const propertyNames: string[] = []
        let nodeToReplaceWithBindingPattern: ts.Identifier | null = null
        for (const pos of highlightPositions) {
            const highlightedNode = findChildContainingExactPosition(sourceFile, pos)

            if (!highlightedNode) continue

            if (ts.isIdentifier(highlightedNode) && ts.isPropertyAccessExpression(highlightedNode.parent)) {
                propertyNames.push(highlightedNode.parent.name.getText())
                tracker.replaceRange(sourceFile, { pos, end: highlightedNode.parent.end }, highlightedNode.parent.name)
                continue
            }

            if (ts.isIdentifier(highlightedNode) && (ts.isVariableDeclaration(highlightedNode.parent) || ts.isParameter(highlightedNode.parent))) {
                nodeToReplaceWithBindingPattern = highlightedNode
                continue
            }
        }

        if (!nodeToReplaceWithBindingPattern) return
        const bindings = propertyNames.map(name => {
            return ts.factory.createBindingElement(undefined, undefined, name)
        })
        const bindingPattern = ts.factory.createObjectBindingPattern(bindings)
        const { pos, end } = nodeToReplaceWithBindingPattern

        tracker.replaceRange(sourceFile, { pos: pos + nodeToReplaceWithBindingPattern.getLeadingTriviaWidth(), end }, bindingPattern)

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
    },
} satisfies CodeAction
