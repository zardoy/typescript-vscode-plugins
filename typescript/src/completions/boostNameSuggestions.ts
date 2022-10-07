import { boostExistingSuggestions, boostOrAddSuggestions, findChildContainingPosition } from '../utils'

// 1. add suggestions for unresolved indentifiers in code
// 2. boost identifer or type name suggestion
export default (
    entries: ts.CompletionEntry[],
    position: number,
    sourceFile: ts.SourceFile,
    node: ts.Node,
    languageService: ts.LanguageService,
): ts.CompletionEntry[] | undefined => {
    // todo getPreviousPartNode() util
    // todo object key
    const fileText = sourceFile.getFullText()
    const fileTextBeforePos = fileText.slice(0, position)
    const preConstNodeOffset = fileTextBeforePos.match(/(?:const|let) ([\w\d]*)$/i)?.[1]
    /** false - pick all identifiers after cursor
     * node - pick identifiers that within node */
    let filterBlock: undefined | false | ts.Node
    if (preConstNodeOffset !== undefined) {
        const node = findChildContainingPosition(ts, sourceFile, position - preConstNodeOffset.length - 2)
        if (!node || !ts.isVariableDeclarationList(node)) return
        filterBlock = false
    } else if (ts.isIdentifier(node) && node.parent?.parent) {
        // node > parent1 > parent2
        let parent1 = node.parent
        let parent2 = parent1.parent
        if (ts.isParameter(parent1) && isFunction(parent2)) {
            filterBlock = parent2.body ?? false
        }
        if (ts.isQualifiedName(parent1)) parent1 = parent1.parent
        parent2 = parent1.parent
        if (ts.isTypeReferenceNode(parent1) && ts.isParameter(parent2) && isFunction(parent2.parent) && ts.isIdentifier(parent2.name)) {
            const name = parent2.name.text.replace(/^_/, '')
            // its name convention in TS
            const nameUpperFirst = name[0]!.toUpperCase() + name.slice(1)
            return boostExistingSuggestions(entries, ({ name }) => {
                if (!name.includes(nameUpperFirst)) return false
                return true
            })
        }
    }

    if (filterBlock === undefined) return
    const semanticDiagnostics = languageService.getSemanticDiagnostics(sourceFile.fileName)

    const notFoundIdentifiers = semanticDiagnostics
        .filter(({ code }) => [2552, 2304].includes(code))
        .filter(({ start, length }) => {
            if ([start, length].some(x => x === undefined)) return false
            if (filterBlock === false) return start! > position
            const diagnosticEnd = start! + length!
            const { pos, end } = filterBlock!
            if (start! < pos) return false
            if (diagnosticEnd > end) return false
            return true
        })
    const generalNotFoundNames = [...new Set(notFoundIdentifiers.map(({ start, length }) => fileText.slice(start!, start! + length!)))]
    return boostOrAddSuggestions(
        entries,
        generalNotFoundNames.map(name => ({ name, kind: ts.ScriptElementKind.warning })),
    )

    function isFunction(node: ts.Node): node is ts.ArrowFunction | ts.FunctionDeclaration {
        if (!node) return false
        return ts.isArrowFunction(node) || ts.isFunctionDeclaration(node)
    }
}
