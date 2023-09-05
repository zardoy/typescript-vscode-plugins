import { getChangesTracker } from '../../utils'
import { CodeAction } from '../getCodeActions'

const finalChainElement = (node: ts.Node) =>
    ts.isThisTypeNode(node) || ts.isIdentifier(node) || ts.isParenthesizedExpression(node) || ts.isObjectLiteralExpression(node) || ts.isNewExpression(node)

const validChainElement = (node: ts.Node) =>
    ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node) || ts.isNonNullExpression(node)

function verifyMatch(match: ts.Expression): boolean {
    let currentChainElement = match

    while (!finalChainElement(currentChainElement)) {
        if (!validChainElement(currentChainElement)) {
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

export default {
    id: 'addDestructure',
    name: 'Add Destructure',
    kind: 'refactor.rewrite.addDestructure',
    tryToApply(sourceFile, position, _range, node, _formatOptions) {
        if (!node || !position || !ts.isIdentifier(node) || !ts.isPropertyAccessExpression(node.parent) || !ts.isVariableDeclaration(node.parent.parent)) return

        const declaration = node.parent.parent
        const { initializer, type, name: declarationName } = declaration

        if (!initializer || !verifyMatch(initializer) || !ts.isPropertyAccessExpression(initializer)) return

        const propertyName = initializer.name.text
        const { factory } = ts

        const bindingElement = factory.createBindingElement(
            undefined,
            declarationName.getText() === propertyName ? undefined : propertyName,
            declarationName.getText(),
        )

        const updatedDecl = factory.updateVariableDeclaration(
            declaration,
            factory.createObjectBindingPattern([bindingElement]),
            undefined,
            type
                ? factory.createTypeLiteralNode([factory.createPropertySignature(undefined, factory.createIdentifier(propertyName), undefined, type)])
                : undefined,
            initializer.expression,
        )

        const tracker = getChangesTracker({})

        tracker.replaceNode(sourceFile, declaration, updatedDecl)

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
