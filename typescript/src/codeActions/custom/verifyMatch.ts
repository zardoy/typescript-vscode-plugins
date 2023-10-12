const isFinalChainElement = (node: ts.Node) =>
    ts.isThisTypeNode(node) || ts.isIdentifier(node) || ts.isParenthesizedExpression(node) || ts.isObjectLiteralExpression(node) || ts.isNewExpression(node)

const isValidChainElement = (node: ts.Node) =>
    (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node) || ts.isNonNullExpression(node)) &&
    !ts.isOptionalChain(node)

export const verifyMatch = (match: ts.Expression) => {
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
