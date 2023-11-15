export const collectBindings = (node: ts.BindingPattern): ts.BindingElement[] => {
    const bindings: ts.BindingElement[] = []

    const doCollectBindings = (node: ts.BindingPattern) => {
        for (const element of node.elements) {
            if (ts.isOmittedExpression(element)) {
                continue
            }

            const elementName = element.name

            if (ts.isIdentifier(elementName)) {
                bindings.push(element)
            } else if (ts.isArrayBindingPattern(elementName) || ts.isObjectBindingPattern(elementName)) {
                doCollectBindings(elementName)
            }
        }
    }

    doCollectBindings(node)

    return bindings
}

export const getPropertyIdentifier = (bindingElement: ts.BindingElement): ts.Identifier | undefined => {
    const name = bindingElement.propertyName ?? bindingElement.name
    return ts.isIdentifier(name) ? name : undefined
}
