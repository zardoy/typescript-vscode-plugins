import { compact } from '@zardoy/utils'
import { buildStringCompletion } from '../utils'
import { sharedCompletionContext } from './sharedContext'

export default (): ts.CompletionEntry[] | void => {
    const { program, node } = sharedCompletionContext
    if (!node || !ts.isStringLiteralLike(node)) return
    const stringNode = node
    const checker = program.getTypeChecker()!
    let type: ts.Type
    let objType: ts.Type | undefined
    if (ts.isElementAccessExpression(node.parent)) {
        objType = checker.getTypeAtLocation(node.parent.expression)
    } else if (ts.isPropertyAssignment(node.parent) && ts.isObjectLiteralExpression(node.parent.parent)) {
        objType = checker.getContextualType(node.parent.parent) ?? checker.getTypeAtLocation(node.parent.parent)
    }
    if (objType) {
        const [indexInfo] = checker.getIndexInfosOfType(objType)
        if (indexInfo) {
            type = indexInfo.keyType
        }
    }
    type ??= checker.getContextualType(node) ?? checker.getTypeAtLocation(node)
    const types = type.isUnion() ? type.types : [type]
    if (types.some(type => type.flags & ts.TypeFlags.TemplateLiteral)) {
        return compact(
            types.map(type => {
                if (!(type.flags & ts.TypeFlags.TemplateLiteral)) return

                const {
                    texts: [head, ...spans],
                } = type as ts.TemplateLiteralType
                const texts = [head!, ...spans.flatMap(span => (span === '' ? [''] : ['', span]))]
                let tabStop = 1
                return buildStringCompletion(stringNode, {
                    name: texts.map(text => (text === '' ? '|' : text)).join(''),
                    sortText: '07',
                    insertText: texts.map(text => (text === '' ? `$${tabStop++}` : text.replaceAll('$', '\\$'))).join(''),
                    isSnippet: true,
                })
            }),
        )
    }

    return undefined
}
