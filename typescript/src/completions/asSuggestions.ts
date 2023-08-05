import { findChildContainingExactPosition } from '../utils'
import { sharedCompletionContext } from './sharedContext'

export default () => {
    const typeChecker = sharedCompletionContext.program.getTypeChecker()
    const { position, fullText, prior } = sharedCompletionContext
    if (!fullText.slice(0, position - 1).endsWith('as')) return
    const node = findChildContainingExactPosition(sharedCompletionContext.sourceFile, position - 2)
    if (!node || !ts.isAsExpression(node)) return
    const typeAtLocation = typeChecker.getTypeAtLocation(node.expression)
    const type = typeChecker.typeToString(typeAtLocation)
    const widenType = typeChecker.typeToString(typeChecker.getBaseTypeOfLiteralType(typeAtLocation))

    if (type !== widenType) {
        prior.entries.push({
            kind: ts.ScriptElementKind.unknown,
            name: widenType,
            sortText: '!',
        })
    }
    prior.entries.push({
        kind: ts.ScriptElementKind.unknown,
        name: type,
        sortText: '!',
    })
}
