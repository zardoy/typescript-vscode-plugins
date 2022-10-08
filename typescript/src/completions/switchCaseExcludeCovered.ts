import { oneOf } from '@zardoy/utils'
import { cleanupEntryName } from '../utils'

// implementation not even ideal, but it just works for string & enums, which are used in 99% cases
export default (entries: ts.CompletionEntry[], position: number, sourceFile: ts.SourceFile, leftNode: ts.Node) => {
    if (!leftNode.parent?.parent) return
    let nodeComp = leftNode
    let enumAccessExpr: string | null | undefined
    if (ts.isStringLiteral(leftNode)) enumAccessExpr = null
    else {
        enumAccessExpr = getPropAccessExprRestText(leftNode)
        if (!ts.isCaseClause(nodeComp.parent)) nodeComp = leftNode.parent
    }
    if (enumAccessExpr === undefined) return
    let currentClause: ts.CaseClause
    // just for type inferrence
    const clauses = ts.isCaseClause(nodeComp.parent) && ts.isCaseBlock(nodeComp.parent.parent) ? nodeComp.parent.parent?.clauses : undefined
    if (!clauses) return
    currentClause = nodeComp.parent as ts.CaseClause
    const coveredValues: string[] = []
    for (const clause of clauses) {
        if (ts.isDefaultClause(clause) || clause === currentClause) continue
        const { expression } = clause
        if (enumAccessExpr === null) {
            if (ts.isStringLiteralLike(expression)) coveredValues.push(expression.text)
        } else {
            if (getPropAccessExprRestText(expression) === enumAccessExpr) {
                coveredValues.push((expression as ts.PropertyAccessExpression).name.text)
            }
        }
    }
    return entries.filter(
        ({ name, kind }) =>
            !oneOf(kind, ts.ScriptElementKind.memberVariableElement, ts.ScriptElementKind.enumMemberElement, ts.ScriptElementKind.string) ||
            !coveredValues.includes(cleanupEntryName({ name })),
    )
}

const getPropAccessExprRestText = (node: ts.Node) => {
    let propNode = node
    if (ts.isPropertyAccessExpression(node.parent)) {
        propNode = node.parent
    }
    if (!ts.isPropertyAccessExpression(propNode)) return
    return propNode.getText().slice(0, propNode.name.getStart() - propNode.getStart() - 1 /* -1 for dot */)
}
