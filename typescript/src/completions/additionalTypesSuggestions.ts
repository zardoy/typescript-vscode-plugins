export default (entries: ts.CompletionEntry[], program: ts.Program, leftNode: ts.Node) => {
    if (!ts.isStringLiteral(leftNode) || !ts.isTypeParameterDeclaration(leftNode.parent.parent) || leftNode.parent.parent.default !== leftNode.parent) return
    const typeChecker = program.getTypeChecker()
    const { constraint } = leftNode.parent.parent
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
