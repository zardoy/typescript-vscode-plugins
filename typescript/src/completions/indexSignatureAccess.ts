import type tslib from 'typescript/lib/tsserverlibrary'

export default (
    position: number,
    node: tslib.Node | undefined,
    scriptSnapshot: tslib.IScriptSnapshot,
    sourceFile: tslib.SourceFile,
    program: tslib.Program,
    ts: typeof tslib,
): tslib.CompletionEntry[] => {
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
            // derang completion is used on other side
            sortText: prop.name === usedProp ? '9999' : '',
        }
    })
}
