import { cloneDeep, isNumber } from 'lodash'
import { getChangesTracker } from '../../utils'
import { CodeAction } from '../getCodeActions'

export const getPropertyIdentifier = (bindingElement: ts.BindingElement): ts.Identifier | undefined => {
    const name = bindingElement.propertyName ?? bindingElement.name
    return ts.isIdentifier(name) ? name : undefined
}
const createFlattenedExpressionFromDestructuring = (bindingElement: ts.BindingElement, baseExpression: ts.Expression, factory: ts.NodeFactory) => {
    // number: array index; identifier: property name
    const propertyAccessors: Array<ts.Identifier | number> = []
    let current: ts.Node = bindingElement
    while (ts.isBindingElement(current)) {
        propertyAccessors.push(ts.isObjectBindingPattern(current.parent) ? getPropertyIdentifier(current)! : current.parent.elements.indexOf(current))
        current = current.parent.parent
    }

    const expression = cloneDeep(baseExpression)

    return propertyAccessors.reduceRight((_, __, i) => {
        const accessor = propertyAccessors[i]
        return isNumber(accessor)
            ? factory.createElementAccessExpression(expression, factory.createNumericLiteral(accessor))
            : factory.createPropertyAccessExpression(expression, accessor!.text)
    }, baseExpression)
}
export default {
    id: 'fromDestructure',
    name: 'From Destructure',
    kind: 'refactor.rewrite.from-destruct',
    tryToApply(sourceFile, position, _range, node, formatOptions) {
        if (!node || !position) return
        const declaration = ts.findAncestor(node, n => ts.isVariableDeclaration(n)) as ts.VariableDeclaration | undefined
        if (
            !declaration ||
            !ts.isVariableDeclarationList(declaration.parent) ||
            !(ts.isObjectBindingPattern(declaration.name) || ts.isArrayBindingPattern(declaration.name))
        )
            return
        const { initializer } = declaration
        if (!initializer) return

        const bindings = declaration.name.elements as ts.NodeArray<ts.BindingElement>
        const { factory } = ts

        const declarations = bindings.map(bindingElement =>
            factory.createVariableDeclaration(
                bindingElement.name,
                undefined,
                undefined,
                createFlattenedExpressionFromDestructuring(bindingElement, initializer, factory),
            ),
        )

        const tracker = getChangesTracker(formatOptions ?? {})

        const variableDeclarationList = declaration.parent
        const updatedVariableDeclarationList = factory.updateVariableDeclarationList(variableDeclarationList, declarations)

        tracker.replaceNode(sourceFile, variableDeclarationList, updatedVariableDeclarationList, { leadingTriviaOption: 1 })

        const changes = tracker.getChanges()
        if (!changes) return undefined
        return {
            edits: [
                {
                    fileName: sourceFile.fileName,
                    textChanges: changes[0]!.textChanges,
                },
            ],
        }
    },
} satisfies CodeAction
