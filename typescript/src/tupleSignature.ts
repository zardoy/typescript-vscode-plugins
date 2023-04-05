import { compact } from '@zardoy/utils'

export const getTupleSignature = (node: ts.Node, typeChecker: ts.TypeChecker) => {
    const originalNode = node

    let i = -1
    let targetNode: ts.Node | undefined

    const setIndex = (elements: ts.NodeArray<any>) => {
        i = elements.indexOf(originalNode)
        if (i === -1) i = elements.length
    }

    if (ts.isIdentifier(node)) node = node.parent
    if (ts.isOmittedExpression(node)) node = node.parent
    if (ts.isArrayBindingPattern(node)) {
        if (node.parent.name === node) {
            targetNode = node
            setIndex(node.parent.name.elements)
        }
        //     if (ts.isVariableDeclaration(node.parent) && ts.isVariableDeclarationList(node.parent.parent) && ts.isForOfStatement(node.parent.parent.parent)) {
        //         const expr = node.parent.parent.parent.expression
        //         targetNode = expr
        //         setIndex((node.parent.name as ts.ArrayBindingPattern).elements)
        //     }
        //     if (ts.isVariableDeclaration(node.parent) && node.parent.initializer) {
        //         targetNode = node.parent.initializer
        //         setIndex((node.parent.name as ts.ArrayBindingPattern).elements)
        //     }
        //     if (ts.isParameter(node.parent)) {
        //         targetNode = node.parent
        //         setIndex((node.parent.name as ts.ArrayBindingPattern).elements)
        //     }
    } else if (ts.isArrayLiteralExpression(node) && ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        targetNode = node.parent.left
        setIndex(node.elements)
    }

    if (!targetNode) return

    const type = typeChecker.getTypeAtLocation(targetNode)
    const properties = type.getProperties()
    // simple detect that not a tuple
    if (!properties.some(property => property.name === '0')) return
    const currentMember = properties.findIndex(property => property.name === i.toString())
    let currentHasLabel = false
    const tupleMembers = compact(
        properties.map((property, i) => {
            if (!/^\d+$/.test(property.name)) return
            const type = typeChecker.getTypeOfSymbolAtLocation(property, targetNode!)
            let displayString = typeChecker.typeToString(type)
            const tupleLabelDeclaration: ts.NamedTupleMember | undefined = property['target']?.['tupleLabelDeclaration']
            const tupleLabel = tupleLabelDeclaration?.name.text
            if (tupleLabel) {
                displayString = `${tupleLabel}: ${displayString}`
                if (i === currentMember) currentHasLabel = true
            }
            return displayString
        }),
    )
    return { tupleMembers, currentMember, currentHasLabel }
}
