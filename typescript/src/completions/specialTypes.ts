import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    const { program, c } = sharedCompletionContext
    let node = sharedCompletionContext.node!
    if (!node) return
    const typeChecker = program.getTypeChecker()!
    // const type = typeChecker.getContextualType(node as ts.Expression)
    if (ts.isStringLiteral(node)) node = node.parent
    const call = ts.findAncestor(node, node => {
        if (ts.isCallLikeExpression(node)) return true
        if (ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node) || ts.isParenthesizedExpression(node) || ts.isPropertyAssignment(node)) {
            return false
        } else {
            return 'quit'
        }
    })
    const type = typeChecker.getTypeAtLocation(call!)
    const signatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
    // if (!type) return
    // const typeNode = typeChecker.typeToTypeNode(type, node, ts.NodeBuilderFlags.UseFullyQualifiedType)
}
