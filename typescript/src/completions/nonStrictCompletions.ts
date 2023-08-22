import { oneOf } from '@zardoy/utils'
import { matchParents } from '../utils'
import { sharedCompletionContext } from './sharedContext'

export default () => {
    const { typeChecker, node: srcNode } = sharedCompletionContext
    if (!srcNode) return
    const targetNode = getCompletingAgainstType(srcNode)
    if (!targetNode) return
    const type = (ts.isExpression(targetNode) && typeChecker.getContextualType(targetNode)) || typeChecker.getTypeAtLocation(targetNode)
    // if (type.isUnion() && type.)
    console.log(type)
}

export const getCompletingAgainstType = (node: ts.Node) => {
    const binary = matchParents(node.parent, ['BinaryExpression'])
    if (
        binary &&
        oneOf(
            binary.operatorToken.kind,
            ts.SyntaxKind.EqualsEqualsToken,
            ts.SyntaxKind.EqualsEqualsEqualsToken,
            ts.SyntaxKind.ExclamationEqualsToken,
            ts.SyntaxKind.ExclamationEqualsEqualsToken,
        )
    ) {
        return binary.left === node ? binary.right : binary.left
    }
    // return matchParents(node, ['Proper'])
}
