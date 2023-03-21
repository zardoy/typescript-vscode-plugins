import { isArrayLike } from './arrayMethods'

// currently WIP
export default (node: ts.Node, entries: ts.CompletionEntry[]): ts.CompletionEntry[] | undefined => {
    if (ts.isObjectLiteralExpression(node) && isArrayLike(entries)) {
        return [
            {
                name: '<array methods>',
                kind: ts.ScriptElementKind.label,
                sortText: '07',
                insertText: '[]',
                labelDetails: { detail: ' change {} to []' },
            },
            ...entries,
        ]
    }
    return undefined
}
