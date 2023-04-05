import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    const { c, prevCompletionsMap } = sharedCompletionContext

    const displayImportedInfo = c('suggestions.displayImportedInfo')
    if (displayImportedInfo === 'disable') return

    for (const entry of entries) {
        const { symbol } = entry
        if (!symbol) continue
        const [node] = symbol.getDeclarations() ?? []
        if (!node) continue
        let importDeclaration: ts.ImportDeclaration | undefined
        if (ts.isImportSpecifier(node) && ts.isNamedImports(node.parent) && ts.isImportDeclaration(node.parent.parent.parent)) {
            importDeclaration = node.parent.parent.parent
        } else if (ts.isImportClause(node) && ts.isImportDeclaration(node.parent)) {
            importDeclaration = node.parent
        } else if (ts.isNamespaceImport(node) && ts.isImportClause(node.parent) && ts.isImportDeclaration(node.parent.parent)) {
            // todo-low(builtin) maybe reformat text
            importDeclaration = node.parent.parent
        }
        if (importDeclaration) {
            prevCompletionsMap[entry.name] ??= {}
            let importPath = importDeclaration.moduleSpecifier.getText()
            const symbolsLimit = 40
            if (importPath.length > symbolsLimit) importPath = `${importPath.slice(0, symbolsLimit / 2)}...${importPath.slice(-symbolsLimit / 2)}`
            const detailPrepend = displayImportedInfo === 'short-format' ? `(from ${importPath}) ` : `Imported from ${importPath}\n\n`
            prevCompletionsMap[entry.name]!.detailPrepend = detailPrepend
        }
    }
}
