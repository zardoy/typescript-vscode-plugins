import { isNumber } from 'lodash'
import { getPropertyIdentifier } from './utils'

export default (bindingElement: ts.BindingElement, baseExpression: ts.Expression) => {
    // number: array index; identifier: property name
    const propertyAccessors: Array<ts.Identifier | number> = []
    let current: ts.Node = bindingElement
    while (ts.isBindingElement(current)) {
        propertyAccessors.push(ts.isObjectBindingPattern(current.parent) ? getPropertyIdentifier(current)! : current.parent.elements.indexOf(current))
        current = current.parent.parent
    }

    let flattenedExpression = baseExpression
    for (const [i, _] of propertyAccessors.reverse().entries()) {
        const accessor = propertyAccessors[i]

        flattenedExpression = isNumber(accessor)
            ? ts.factory.createElementAccessExpression(flattenedExpression, ts.factory.createNumericLiteral(accessor))
            : ts.factory.createPropertyAccessExpression(flattenedExpression, accessor!.text)
    }
    return flattenedExpression
}
