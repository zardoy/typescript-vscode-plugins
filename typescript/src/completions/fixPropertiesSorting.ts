import { oneOf } from '@zardoy/utils'
import { partition } from 'rambda'
import { getAllPropertiesOfType } from './objectLiteralCompletions'
import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    const { node, program, c } = sharedCompletionContext
    if (!c('fixSuggestionsSorting')) return
    if (!node) return
    // if (ts.isObjectLiteralExpression(node) && ts.isCallExpression(node.parent)) {
    //     const typeChecker = program.getTypeChecker()
    //     const type = typeChecker.getTypeAtLocation(node.parent)
    //     const callSignatures = type.getCallSignatures()
    // }
    let rightNode: ts.Node | undefined
    const upperNode = ts.isIdentifier(node) ? node.parent : node
    if (ts.isObjectLiteralExpression(node)) rightNode = node
    if (ts.isPropertyAccessExpression(upperNode)) rightNode = upperNode.expression
    else if (ts.isObjectBindingPattern(node)) {
        if (ts.isVariableDeclaration(node.parent)) {
            const { initializer } = node.parent
            if (initializer) {
                if (ts.isIdentifier(initializer)) rightNode = initializer
                if (ts.isPropertyAccessExpression(initializer)) rightNode = initializer.name
            }
        }
        if (ts.isParameter(node.parent)) rightNode = node.parent.type
    } else if (ts.isObjectLiteralExpression(node) && ts.isReturnStatement(node.parent) && ts.isArrowFunction(node.parent.parent.parent)) {
        rightNode = node.parent.parent.parent.type
    }
    if (!rightNode) return
    const typeChecker = program.getTypeChecker()
    const type = typeChecker.getContextualType(rightNode as ts.Expression) ?? typeChecker.getTypeAtLocation(rightNode)
    const sourceProps = getAllPropertiesOfType(type, typeChecker)?.map(({ name }) => name)
    // languageService.getSignatureHelpItems(fileName, position, {}))
    if (!sourceProps) return
    // const entriesBySortText = groupBy(({ sortText }) => sortText, entries)
    const [interestedEntries, notInterestedEntries] = partition(
        entry => oneOf(entry.kind, ts.ScriptElementKind.memberVariableElement, ts.ScriptElementKind.memberFunctionElement),
        entries,
    )
    // if sortText first symbol is not a number, than most probably it was highlighted by IntelliCode, keep them high
    const [sortableEntries, notSortableEntries] = partition(entry => !isNaN(parseInt(entry.sortText)), interestedEntries)
    const lowestSortText = Math.min(...sortableEntries.map(({ sortText }) => parseInt(sortText)))
    // make sorted
    const sortedEntries = sortableEntries
        .sort((a, b) => {
            return sourceProps.indexOf(a.name) - sourceProps.indexOf(b.name)
        })
        .map((entry, i) => ({ ...entry, sortText: String(lowestSortText + i) }))
    return [...notSortableEntries, ...sortedEntries, ...notInterestedEntries]
}
