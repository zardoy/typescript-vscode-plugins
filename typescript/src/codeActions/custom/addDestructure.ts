import { findChildContainingExactPosition, getChangesTracker, getNodeHighlightPositions } from '../../utils'
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
const addDestructureToVariableWithSplittedPropertyAccessors = (
    node: ts.Node,
    sourceFile: ts.SourceFile,
    formatOptions: ts.FormatCodeSettings | undefined,
    languageService: ts.LanguageService,
) => {
    if (!ts.isIdentifier(node) && !(ts.isPropertyAccessExpression(node.parent) || ts.isParameter(node.parent))) return

    const highlightPositions = getNodeHighlightPositions(node, sourceFile, languageService)

    if (!highlightPositions) return
    const tracker = getChangesTracker(formatOptions ?? {})

    const propertyNames: string[] = []
    let nodeToReplaceWithBindingPattern: ts.Identifier | undefined

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
        const uniqueAccessorName = tsFull.getUniqueName(name, sourceFile as unknown as FullSourceFile)

        return ts.factory.createBindingElement(undefined, name, uniqueAccessorName)
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
            if (createdDeclaration) {
                tracker.replaceRange(
                    sourceFile,
                    {
                        pos: initialDeclaration.pos,
                        end: initialDeclaration.end,
                    },
                    createdDeclaration,
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

            if (ts.isIdentifier(node)) {
                return addDestructureToVariableWithSplittedPropertyAccessors(node, sourceFile, formatOptions, languageService)
            }
        }
        return addDestructureToVariableWithSplittedPropertyAccessors(node, sourceFile, formatOptions, languageService)
    },
} satisfies CodeAction
