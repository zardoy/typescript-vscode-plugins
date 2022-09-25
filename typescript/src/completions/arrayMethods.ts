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

    return entries.map(entry => {
        if (!arrayMethodsToPatch.includes(entry.name.replace(/^★ /, ''))) return entry
        const arrayItemSnippet = c('arrayMethodsSnippets.addArgTabStop') ? `(\${2:${inferredName}})` : inferredName
        let insertInnerSnippet = `${arrayItemSnippet} => $3`
        if (c('arrayMethodsSnippets.addOuterTabStop')) insertInnerSnippet = `\${1:${insertInnerSnippet}}`
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
