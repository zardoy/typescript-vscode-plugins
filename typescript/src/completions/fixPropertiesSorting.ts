import { oneOf } from '@zardoy/utils'
import { partition } from 'rambda'
import { getAllPropertiesOfType } from './objectLiteralCompletions'
import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    const { node, program, c } = sharedCompletionContext
    if (!c('fixSuggestionsSorting')) return
    if (!node) return
    let targetNode: ts.Node | undefined
    let upperNode = ts.isIdentifier(node) ? node.parent : node
    if (ts.isJsxAttributes(upperNode)) upperNode = upperNode.parent
    if (ts.isObjectLiteralExpression(node)) targetNode = node
    const isJsxElem = ts.isJsxOpeningElement(upperNode) || ts.isJsxSelfClosingElement(upperNode)
    if (isJsxElem) {
        targetNode = upperNode
    } else if (ts.isPropertyAccessExpression(upperNode)) targetNode = upperNode.expression
    else if (ts.isObjectBindingPattern(node)) {
        if (ts.isVariableDeclaration(node.parent)) {
            const { initializer } = node.parent
            if (initializer) {
                if (ts.isIdentifier(initializer)) targetNode = initializer
                if (ts.isPropertyAccessExpression(initializer)) targetNode = initializer.name
            }
        }
        if (ts.isParameter(node.parent)) targetNode = node.parent.type
    } else if (ts.isObjectLiteralExpression(node) && ts.isReturnStatement(node.parent) && ts.isArrowFunction(node.parent.parent.parent)) {
        targetNode = node.parent.parent.parent.type
    }
    if (!targetNode) return
    const typeChecker = program.getTypeChecker()
    let sourceProps: string[]
    if (isJsxElem) {
        const type = typeChecker.getContextualType((targetNode as ts.JsxOpeningElement).attributes)
        if (!type) return
        // usually component own props defined first like interface Props extends ... {} or type A = Props & ..., but this is not a case with mui...
        sourceProps = (type.isIntersection() ? type.types.flatMap(type => type.getProperties()) : type.getProperties()).map(symbol => symbol.name)
    } else {
        const type = typeChecker.getContextualType(targetNode as ts.Expression) ?? typeChecker.getTypeAtLocation(targetNode)
        sourceProps = getAllPropertiesOfType(type, typeChecker)?.map(({ name }) => name)
    }
    // languageService.getSignatureHelpItems(fileName, position, {}))
    if (!sourceProps) return
    // const entriesBySortText = groupBy(({ sortText }) => sortText, entries)
    const [interestedEntries, notInterestedEntries] = partition(
        entry => oneOf(entry.kind, ts.ScriptElementKind.memberVariableElement, ts.ScriptElementKind.memberFunctionElement),
        entries,
    )
    // if sortText first symbol is not a number, than most probably it was highlighted by IntelliCode, keep them high
    const [sortableEntries, notSortableEntries] = partition(entry => !Number.isNaN(Number.parseInt(entry.sortText, 10)), interestedEntries)
    const lowestSortText = Math.min(...sortableEntries.map(({ sortText }) => Number.parseInt(sortText, 10)))
    const getScore = (completion: ts.CompletionEntry) => {
        return (
            sourceProps.indexOf(completion.name) +
            (isJsxElem && completion.symbol?.declarations?.[0]?.getSourceFile().fileName.includes('@types/react') ? 10_000 : 0)
        )
    }
    // make sorted
    const sortedEntries = sortableEntries
        .sort((a, b) => {
            return getScore(a) - getScore(b)
        })
        .map((entry, i) => ({ ...entry, sortText: String(Number.parseInt(entry.sortText, 10)) }))
    return [...notSortableEntries, ...sortedEntries, ...notInterestedEntries]
}
