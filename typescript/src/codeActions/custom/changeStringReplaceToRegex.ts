import escapeStringRegexp from 'escape-string-regexp'
import { CodeAction } from '../getCodeActions'
import { getChangesTracker } from '../../utils'

export default {
    id: 'changeStringReplaceToRegex',
    name: 'Change to Regex',
    kind: 'refactor.rewrite.stringToRegex',
    tryToApply(sourceFile, position, _range, node, formatOptions) {
        if (!node || !position) return
        // requires full explicit object selection (be aware of comma) to not be annoying with suggestion
        if (!ts.isStringLiteral(node)) return
        if (!ts.isCallExpression(node.parent) || node.parent.arguments[0] !== node) return
        if (!ts.isPropertyAccessExpression(node.parent.expression)) return
        if (node.parent.expression.name.text !== 'replace') return
        if (!formatOptions) return true
        const changesTracker = getChangesTracker({})
        const { factory } = ts
        const replaceNode = factory.createRegularExpressionLiteral(
            // though it does to much escaping and ideally should be simplified
            `/${escapeStringRegexp(node.text).replaceAll('\n', '\\n').replaceAll('\t', '\\t').replaceAll('\r', '\\r')}/`,
        )

        changesTracker.replaceNode(sourceFile, node, replaceNode)
        return {
            edits: [
                {
                    fileName: sourceFile.fileName,
                    textChanges: changesTracker.getChanges()[0]!.textChanges,
                },
            ],
        }
    },
} satisfies CodeAction
