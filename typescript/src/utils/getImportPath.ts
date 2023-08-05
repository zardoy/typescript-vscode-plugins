export default (symbol: ts.Symbol) => {
    const [node] = symbol.declarations ?? []
    if (!node) return

    if (!node) return undefined
    let importDeclaration: ts.ImportDeclaration | undefined
    let importKind!: ts.SyntaxKind
    if (ts.isImportSpecifier(node) && ts.isNamedImports(node.parent) && ts.isImportDeclaration(node.parent.parent.parent)) {
        importDeclaration = node.parent.parent.parent
        importKind = ts.SyntaxKind.NamedImports
    } else if (ts.isImportClause(node) && ts.isImportDeclaration(node.parent)) {
        importDeclaration = node.parent
    } else if (ts.isNamespaceImport(node) && ts.isImportClause(node.parent) && ts.isImportDeclaration(node.parent.parent)) {
        // todo-low(builtin) maybe reformat text
        importDeclaration = node.parent.parent
        importKind = ts.SyntaxKind.NamespaceImport
    }

    if (!importDeclaration) return undefined
    return {
        quotedPath: importDeclaration.moduleSpecifier.getText(),
        importKind,
    }
}
