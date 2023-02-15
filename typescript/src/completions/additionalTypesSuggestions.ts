export default (entries: ts.CompletionEntry[], program: ts.Program, node: ts.Node) => {
    if (!ts.isStringLiteral(node)) return
    const typeChecker = program.getTypeChecker()
    if (ts.isLiteralTypeNode(node.parent)) {
        node = node.parent
        const previousValues: string[] = []
        if (node.parent.kind === ts.SyntaxKind.UnionType) {
            ;(node.parent as ts.UnionTypeNode).types.forEach(type => {
                if (ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)) {
                    previousValues.push(type.literal.text)
                }
            })
            node = node.parent
        }
        if (ts.isTypeReferenceNode(node.parent) && node.parent.typeName.getText() === 'Omit' && node.parent.typeArguments?.[1] === node) {
            // Omit<..., '|'> suggestions
            const type = typeChecker.getTypeFromTypeNode(node.parent.typeArguments[0]!)
            type.getProperties().forEach(({ name }) => {
                if (previousValues.includes(name)) return
                entries.push({
                    name,
                    kind: ts.ScriptElementKind.string,
                    sortText: '',
                })
            })
            return
        }
    }
    if (!ts.isTypeParameterDeclaration(node.parent) || node.parent.default !== node) return
    const { constraint } = node.parent
    if (!constraint) return
    const type = typeChecker.getTypeAtLocation(constraint)
    if (!(type.flags & ts.TypeFlags.Union)) return
    const { types } = (type as any) ?? {}
    const values: string[] = types.map(({ value }) => (typeof value === 'string' ? value : undefined)).filter(Boolean)
    return values.map(
        (value): ts.CompletionEntry => ({
            name: value,
            kind: ts.ScriptElementKind.string,
            sortText: '',
        }),
    )
}
