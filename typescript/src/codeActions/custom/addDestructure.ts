import { getChangesTracker } from '../../utils'
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
        const castedChainElement = currentChainElement as
            | ts.PropertyAccessExpression
            | ts.CallExpression
            | ts.ElementAccessExpression
            | ts.NonNullExpression
            | ts.ParenthesizedExpression
            | ts.AwaitExpression

        currentChainElement = castedChainElement.expression
    }

    return true
}

const isPositionMatchesInitializer = (pos: number, initializer: ts.Expression) => {
    return pos >= initializer.getStart() && pos <= initializer.getEnd()
}

export default {
    id: 'addDestruct',
    name: 'Add Destruct',
    kind: 'refactor.rewrite.add-destruct',
    tryToApply(sourceFile, position, _range, node, formatOptions) {
        if (!node || !position) return
        const declaration = ts.findAncestor(node, n => ts.isVariableDeclaration(n)) as ts.VariableDeclaration | undefined
        if (!declaration || ts.isObjectBindingPattern(declaration.name)) return

        const { initializer, type, name: declarationName } = declaration

        if (!initializer || !isPositionMatchesInitializer(position, initializer) || !verifyMatch(initializer) || !ts.isPropertyAccessExpression(initializer))
            return

        const propertyName = initializer.name.text
        const { factory } = ts

        const bindingElement = factory.createBindingElement(
            undefined,
            declarationName.getText() === propertyName ? undefined : propertyName,
            declarationName.getText(),
        )

        const updatedDeclaration = factory.updateVariableDeclaration(
            declaration,
            factory.createObjectBindingPattern([bindingElement]),
            undefined,
            type
                ? factory.createTypeLiteralNode([factory.createPropertySignature(undefined, factory.createIdentifier(propertyName), undefined, type)])
                : undefined,
            initializer.expression,
        )

        const tracker = getChangesTracker(formatOptions ?? {})

        tracker.replaceNode(sourceFile, declaration, updatedDeclaration)

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
