import { approveCast } from '../utils'
import { CodeAction } from './getCodeActions'

const nodeToSpan = (node: ts.Node): ts.TextSpan => {
    const start = node.pos + (node.getLeadingTriviaWidth() ?? 0)
    return { start, length: node.end - start }
}

export default {
    id: 'objectSwapKeysAndValues',
    name: 'Swap Keys and Values in Object',
    tryToApply(sourceFile, _position, range, node) {
        if (!range || !node) return
        // requires full explicit object selection (be aware of comma) to not be annoying with suggestion
        if (!approveCast(node, ts.isObjectLiteralExpression) || !(range.pos === node.pos + node.getLeadingTriviaWidth() && range.end === node.end)) return
        const edits: ts.TextChange[] = []
        for (const property of node.properties) {
            if (!ts.isPropertyAssignment(property)) continue
            const { name, initializer } = property
            if (!name || ts.isPrivateIdentifier(name)) continue
            const needsComputedBraces = approveCast(initializer, ts.isStringLiteral, ts.isNumericLiteral)
                ? false
                : approveCast(initializer, ts.isIdentifier, ts.isCallExpression, ts.isPropertyAccessExpression)
                ? true
                : undefined
            if (needsComputedBraces === undefined) continue
            let initializerText = initializer.getText()
            if (needsComputedBraces) {
                initializerText = `[${initializerText}]`
            }
            edits.push({
                newText: initializerText,
                span: nodeToSpan(name),
            })
            edits.push({
                newText: ts.isComputedPropertyName(name)
                    ? name.expression.getText()
                    : ts.isIdentifier(name)
                    ? /* TODO quote preference */ `'${name.text}'`
                    : name.getText(),
                span: nodeToSpan(initializer),
            })
        }
        if (!edits.length) return undefined
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
