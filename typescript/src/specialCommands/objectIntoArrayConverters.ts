import { RequestOutputTypes } from '../ipcTypes'
import { approveCast, getIndentFromPos } from '../utils'

const nodeToSpan = (node: ts.Node): ts.TextSpan => {
    const start = node.pos + (node.getLeadingTriviaWidth() ?? 0)
    return { start, length: node.end - start }
}

type FirstStepData = RequestOutputTypes['getTwoStepCodeActions']['turnArrayIntoObject']

// primarily for working with static data
export default <T extends string | undefined>(range: { pos: number; end: number }, node: ts.Node | undefined, selectedKeyName: T): any => {
    if (!range || !node) return
    // requires full explicit array selection (be aware of comma) to not be annoying with suggestion
    if (!approveCast(node, ts.isArrayLiteralExpression) || !(range.pos === node.pos + node.getLeadingTriviaWidth() && range.end === node.end)) return
    let objectHits = 0
    const objectKeysHits: Record<string, number> = {}
    const newObjects: string[] = []
    const startIndent = getIndentFromPos(ts, node.getSourceFile(), range.end)
    outer: for (const item of node.elements) {
        if (ts.isObjectLiteralExpression(item)) {
            objectHits++
            for (const property of item.properties) {
                if (!ts.isPropertyAssignment(property)) continue
                const { name } = property
                if (!name || ts.isPrivateIdentifier(name) || ts.isComputedPropertyName(name)) continue
                const nameText = ts.isStringLiteral(name) ? name.text : name.getText()
                objectKeysHits[nameText] ??= 0
                objectKeysHits[nameText]++
                if (nameText === selectedKeyName) {
                    const fileText = node.getSourceFile().getFullText()
                    // TODO-high it removes comment for the refactoring property!
                    let objectText = fileText.slice(item.pos, property.pos /*  + property.getLeadingTriviaWidth() */)
                    const nextItem = item.properties[item.properties.indexOf(property) + 1]
                    const nextPos = nextItem?.pos
                    if (nextPos !== undefined) {
                        // todo-low comment might be removed (but who puts inline / line comment before dot?)
                        objectText += fileText.slice(nextPos, item.end)
                    }
                    // todo try printer instead (but might be harder)
                    newObjects.push(
                        `${startIndent}${
                            approveCast(property.initializer, ts.isNumericLiteral, ts.isStringLiteral)
                                ? property.initializer.getText()
                                : `[${property.initializer.getText()}]`
                        }: ${objectText.replace(/^\s+/, '')}`,
                    )
                    continue outer
                }
            }
        }
    }
    if (selectedKeyName === undefined) {
        return {
            totalCount: node.elements.length,
            totalObjectCount: objectHits,
            keysCount: objectKeysHits,
        } satisfies FirstStepData
    }
    return [
        {
            newText: `{\n\t${newObjects.join(',\n\t')}\n${startIndent}}`,
            span: nodeToSpan(node),
        },
    ] satisfies ts.TextChange[]
}
