import { GetConfig } from '../types'
import { findChildContainingPosition, getLineTextBeforePos } from '../utils'
import { singular } from 'pluralize'

export default (entries: ts.CompletionEntry[], _node: ts.Node | undefined, position: number, sourceFile: ts.SourceFile, c: GetConfig): ts.CompletionEntry[] => {
    if (!c('arrayMethodsSnippets.enable')) return entries
    /** Methods to patch */
    const arrayMethods = [
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
    const fullText = sourceFile.getText()
    if (fullText.slice(position, position + 1) === '(') return entries
    const isSeemsArray = arrayMethods.every(comparingName =>
        entries.some(
            ({ name, isSnippet, kind }) => name.replace(/^★ /, '') === comparingName && !isSnippet && kind === ts.ScriptElementKind.memberFunctionElement,
        ),
    )
    if (!isSeemsArray) return entries
    const lineTextBefore = getLineTextBeforePos(sourceFile, position)
    const postfixRemoveLength = /\.\w*$/.exec(lineTextBefore)?.[0]?.length
    if (postfixRemoveLength === undefined) return entries
    const nodeBeforeDot = findChildContainingPosition(ts, sourceFile, position - postfixRemoveLength - 1)
    if (!nodeBeforeDot) return entries
    const cleanSourceText = getItemNameFromNode(nodeBeforeDot)?.replace(/^(?:all)?(.+?)(?:List)?$/, '$1')
    let inferredName = cleanSourceText && singular(cleanSourceText)
    const defaultItemName = c('arrayMethodsSnippets.defaultItemName')
    // both can be undefined
    if (inferredName === cleanSourceText) {
        if (defaultItemName === false) return entries
        inferredName = defaultItemName
    }
    return entries.map(entry => {
        if (!arrayMethods.includes(entry.name.replace(/^★ /, ''))) return entry
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
