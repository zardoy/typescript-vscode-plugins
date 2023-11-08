import { findChildContainingExactPosition } from '../utils'
import { sharedCompletionContext } from './sharedContext'

const getCastedTypeCompletionEntry = (typeChecker: ts.TypeChecker, node: ts.Expression) => {
    const typeAtLocation = typeChecker.getTypeAtLocation(node)
    const type = typeChecker.typeToString(typeAtLocation)
    const widenType = typeChecker.typeToString(typeChecker.getBaseTypeOfLiteralType(typeAtLocation))

    return {
        kind: ts.ScriptElementKind.unknown,
        name: type === widenType ? type : widenType,
        sortText: '!',
    }
}

export default () => {
    const typeChecker = sharedCompletionContext.program.getTypeChecker()
    const { position, fullText, prior } = sharedCompletionContext

    // as completions
    if (fullText.slice(0, position - 1).endsWith('as')) {
        const node = findChildContainingExactPosition(sharedCompletionContext.sourceFile, position - 2)
        if (!node || !ts.isAsExpression(node)) return
        const entry = getCastedTypeCompletionEntry(typeChecker, node.expression)
        prior.entries.push(entry)
        return
    }

    // jsdoc typecast completions
    const node = findChildContainingExactPosition(sharedCompletionContext.sourceFile, position)
    if (!node) return
    let typeCastedNode: ts.ParenthesizedExpression | undefined
    node.forEachChild(node => {
        if (ts.isParenthesizedExpression(node) && ts.getJSDocTypeTag(node)) typeCastedNode = node
    })

    if (!typeCastedNode) return
    const entry = getCastedTypeCompletionEntry(typeChecker, typeCastedNode.expression)
    prior.entries.push(entry)
}
