import { CodeAction } from '../getCodeActions'
import escapeStringRegexp from 'escape-string-regexp'

const nodeToSpan = (node: ts.Node): ts.TextSpan => {
    const start = node.pos + (node.getLeadingTriviaWidth() ?? 0)
    return { start, length: node.end - start }
}

export default {
    id: 'changeStringReplaceToRegex',
    name: 'Change to Regex',
    tryToApply(sourceFile, position, _range, node) {
        if (!node || !position) return
        // requires full explicit object selection (be aware of comma) to not be annoying with suggestion
        if (!ts.isStringLiteral(node)) return
        if (!ts.isCallExpression(node.parent) || node.parent.arguments[0] !== node) return
        if (!ts.isPropertyAccessExpression(node.parent.expression)) return
        if (node.parent.expression.name.text !== 'replace') return
        // though it does to much escaping and ideally should be simplified
        const edits: ts.TextChange[] = [{ span: nodeToSpan(node), newText: `/${escapeStringRegexp(node.text)}/` }]
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
