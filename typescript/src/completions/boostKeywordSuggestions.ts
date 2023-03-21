import { boostOrAddSuggestions, findChildContainingPosition } from '../utils'

export default (entries: ts.CompletionEntry[], position: number, node: ts.Node): ts.CompletionEntry[] | undefined => {
    // todo-not-sure for now, requires explicit completion trigger
    const prevCharIsSpace = node.getSourceFile().getFullText()[position - 1] === ' '
    if (!prevCharIsSpace) return
    let extendsKeyword = ts.isInterfaceDeclaration(node) && node.end === position - 1
    const addOrBoostKeywords = [] as string[]
    if (!extendsKeyword) {
        const leftNode = findChildContainingPosition(ts, node.getSourceFile(), position - 2)
        if (leftNode && ts.isIdentifier(leftNode) && ts.isTypeParameterDeclaration(leftNode.parent)) {
            if (!leftNode.parent.constraint) extendsKeyword = true
        } else if (leftNode) {
            if (ts.isBlock(leftNode)) {
                if (ts.isTryStatement(leftNode.parent) && leftNode.parent.tryBlock === leftNode) addOrBoostKeywords.push('catch', 'finally')
                else if (ts.isCatchClause(leftNode.parent) && leftNode.parent.block === leftNode) addOrBoostKeywords.push('finally')
            }
            if (leftNode.kind === ts.SyntaxKind.ExportKeyword) {
                addOrBoostKeywords.push('const', 'function', 'default', 'from', 'let')
            }
        }
    }
    if (extendsKeyword) addOrBoostKeywords.push('extends')
    if (addOrBoostKeywords.length === 0) return
    return boostOrAddSuggestions(
        entries,
        addOrBoostKeywords.map(name => ({ name, kind: ts.ScriptElementKind.keyword })),
    )
}
