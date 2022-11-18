import { GetConfig } from '../types'
import { findChildContainingPosition, getLineTextBeforePos } from '../utils'
import { singular } from 'pluralize'

const arrayMethodsToPatch = [
    'forEach',
    'map',
    'flatMap',
    'filter',
    'find',
    'findIndex',
    //  'reduce',
    //  'reduceRight',
    'some',
    'every',
]

export default (entries: ts.CompletionEntry[], position: number, sourceFile: ts.SourceFile, c: GetConfig): ts.CompletionEntry[] | undefined => {
    if (!c('arrayMethodsSnippets.enable')) return
    /** Methods to patch */

    const fullText = sourceFile.getFullText()
    if (fullText.slice(position, position + 1) === '(') return
    const seemsArray = isArrayLike(entries)
    if (!seemsArray) return

    const lineTextBefore = getLineTextBeforePos(sourceFile, position)
    const postfixRemoveLength = /\.\w*$/.exec(lineTextBefore)?.[0]?.length
    if (postfixRemoveLength === undefined) return
    const nodeBeforeDot = findChildContainingPosition(ts, sourceFile, position - postfixRemoveLength - 1)
    if (!nodeBeforeDot) return

    const cleanSourceText = getItemNameFromNode(nodeBeforeDot)?.replace(/^(?:all)?(.+?)(?:List)?$/, '$1')
    let inferredName = cleanSourceText && singular(cleanSourceText)
    const defaultItemName = c('arrayMethodsSnippets.defaultItemName')
    // both can be undefined
    if (inferredName === cleanSourceText) {
        if (defaultItemName === false) return
        inferredName = defaultItemName
    }

    // workaround for
    // https://github.com/microsoft/vscode/blob/4765b898acb38a44f9dd8fa7ed48e833fff6ecc6/extensions/typescript-language-features/src/languageFeatures/completions.ts#L99
    // (overriding default range)
    // after []. .fill was appearing above .filter becuase .filter is snippet in insertText, not changing insertText of .fill so vscode method completions calls work as expected
    const resetRangeKinds = fullText.slice(position - 1, position) === '.' && [
        ts.ScriptElementKind.constElement,
        ts.ScriptElementKind.memberFunctionElement,
        ts.ScriptElementKind.memberVariableElement,
    ]

    const arrayItemSnippet = c('arrayMethodsSnippets.addArgTabStop') ? `(\${2:${inferredName}})` : inferredName
    let insertInnerSnippet = `${arrayItemSnippet} => $3`
    if (c('arrayMethodsSnippets.addOuterTabStop')) insertInnerSnippet = `\${1:${insertInnerSnippet}}`

    return entries.map(entry => {
        if (!arrayMethodsToPatch.includes(entry.name.replace(/^★ /, ''))) {
            if (resetRangeKinds && resetRangeKinds.includes(entry.kind) && !entry.replacementSpan) {
                return {
                    ...entry,
                    replacementSpan: { start: position, length: 0 },
                }
            }
            return entry
        }
        return {
            ...entry,
            insertText: `${entry.insertText ?? entry.name}(${insertInnerSnippet})`,
            isSnippet: true,
        }
    })
}

const getItemNameFromNode = (node: ts.Node) => {
    if (ts.isIdentifier(node)) return node.text
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.parent)) {
        node = node.parent
        while (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node)) {
            node = node.expression
            if (ts.isIdentifier(node)) return node.text
        }
    }
    return undefined
}

export const isArrayLike = (entries: ts.CompletionEntry[]) => {
    return arrayMethodsToPatch.every(comparingName =>
        entries.some(
            ({ name, isSnippet, kind }) => name.replace(/^★ /, '') === comparingName && !isSnippet && kind === ts.ScriptElementKind.memberFunctionElement,
        ),
    )
}
