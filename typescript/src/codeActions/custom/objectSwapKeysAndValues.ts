import { approveCast } from '../../utils'
import { CodeAction } from '../getCodeActions'

const nodeToSpan = (node: ts.Node): ts.TextSpan => {
    const start = node.pos + (node.getLeadingTriviaWidth() ?? 0)
    return { start, length: node.end - start }
}

export const printNodeForObjectKey = (node: ts.Node) => {
    const needsComputedBraces = approveCast(node, ts.isStringLiteral, ts.isNumericLiteral)
        ? false
        : approveCast(node, ts.isIdentifier, ts.isCallExpression, ts.isPropertyAccessExpression)
        ? true
        : undefined
    if (needsComputedBraces === undefined) return
    let nodeText = node.getText()
    if (needsComputedBraces) {
        nodeText = `[${nodeText}]`
    }
    return nodeText
}

export default {
    id: 'objectSwapKeysAndValues',
    name: 'Swap Keys and Values in Object',
    kind: 'refactor.rewrite.object.swapKeysAndValues',
    tryToApply(sourceFile, _position, range, node, formatOptions) {
        if (!range || !node) return
        // requires full explicit object selection (be aware of comma) to not be annoying with suggestion
        if (
            !approveCast(node, ts.isObjectLiteralExpression) ||
            !(range.pos === node.pos + node.getLeadingTriviaWidth() && range.end === node.end) ||
            node.properties.length === 0
        ) {
            return
        }
        if (!formatOptions) return true
        const edits: ts.TextChange[] = []
        for (const property of node.properties) {
            if (!ts.isPropertyAssignment(property)) continue
            const { name, initializer } = property
            if (!name || ts.isPrivateIdentifier(name)) continue
            const initializerText = printNodeForObjectKey(initializer)
            if (!initializerText) continue
            edits.push(
                {
                    newText: initializerText,
                    span: nodeToSpan(name),
                },
                {
                    newText: ts.isComputedPropertyName(name)
                        ? name.expression.getText()
                        : ts.isIdentifier(name)
                        ? /* TODO quote preference */ `'${name.text}'`
                        : name.getText(),
                    span: nodeToSpan(initializer),
                },
            )
        }
        return {
            edits: [
                {
                    fileName: sourceFile.fileName,
                    textChanges: edits,
                },
            ],
        }
    },
} satisfies CodeAction

// TODO!
if (import.meta.vitest) {
    const { it, expect } = import.meta.vitest
    it('objectSwapKeysAndValues', () => {
        const case1 = /* ts */ `
            const a = /*1*/{
                // description
                test: /*inline comment?*/ 3,
                /** */['test2']: getComputedStyle.apply(),
                'test2': 'someValue'
            }/*2*/
        `
    })
}
