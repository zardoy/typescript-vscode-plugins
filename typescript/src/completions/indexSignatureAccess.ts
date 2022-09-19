export default (
    position: number,
    node: ts.Node | undefined,
    scriptSnapshot: ts.IScriptSnapshot,
    sourceFile: ts.SourceFile,
    program: ts.Program,
): ts.CompletionEntry[] => {
    if (!node || !ts.isStringLiteralLike(node)) return []
    const isConditionalExpression = ts.isConditionalExpression(node.parent)
    // optimize?
    const accessNode = ts.isElementAccessExpression(node.parent)
        ? node.parent
        : isConditionalExpression && ts.isElementAccessExpression(node.parent.parent)
        ? node.parent.parent
        : null
    if (!accessNode) return []
    const typeChecker = program.getTypeChecker()
    const type = typeChecker.getTypeAtLocation(accessNode.expression)
    let usedProp: string | undefined
    if (isConditionalExpression) {
        const otherSideNode = node.parent.whenTrue === node ? node.parent.whenFalse : node.parent.whenTrue
        if (ts.isStringLiteralLike(otherSideNode)) {
            usedProp = otherSideNode.getText().slice(1, -1)
        }
    }
    return type.getProperties().map((prop, i) => {
        return {
            kind: ts.ScriptElementKind.string,
            name: prop.name,
            // derang completions used on other side
            sortText: prop.name === usedProp ? '9999' : '',
        }
    })
}
