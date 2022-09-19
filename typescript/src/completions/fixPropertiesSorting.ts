import { oneOf } from '@zardoy/utils'
import { groupBy, partition } from 'rambda'

export default (entries: ts.CompletionEntry[], node: ts.Node | undefined, sourceFile: ts.SourceFile, program: ts.Program) => {
    if (!node) return
    // if (ts.isObjectLiteralExpression(node) && ts.isCallExpression(node.parent)) {
    //     const typeChecker = program.getTypeChecker()
    //     const type = typeChecker.getTypeAtLocation(node.parent)
    //     const callSignatures = type.getCallSignatures()
    // }
    if (ts.isIdentifier(node)) node = node.parent
    if (!ts.isPropertyAccessExpression(node)) return
    const typeChecker = program.getTypeChecker()
    const expr = node.expression
    const type = typeChecker.getTypeAtLocation(expr)
    const sourceProps = type.getProperties?.()?.map(({ name }) => name)
    // languageService.getSignatureHelpItems(fileName, position, {}))
    if (!sourceProps) return
    // const entriesBySortText = groupBy(({ sortText }) => sortText, entries)
    const [interestedEntries, notInterestedEntries] = partition(
        entry => oneOf(entry.kind, ts.ScriptElementKind.memberVariableElement, ts.ScriptElementKind.memberFunctionElement),
        entries,
    )
    // if sortText first symbol is not a number, than most probably it was highlighted by IntelliCode, keep them high
    const [sortableEntries, notSortableEntries] = partition(entry => !isNaN(+entry.sortText), interestedEntries)
    const lowestSortText = Math.min(...sortableEntries.map(({ sortText }) => +sortText))
    // make sorted
    sortableEntries
        .sort((a, b) => {
            return sourceProps.indexOf(a.name) - sourceProps.indexOf(b.name)
        })
        .map((entry, i) => ({ ...entry, sortText: String(lowestSortText + i) }))
    return [...notSortableEntries, ...sortableEntries, ...notInterestedEntries]
}
