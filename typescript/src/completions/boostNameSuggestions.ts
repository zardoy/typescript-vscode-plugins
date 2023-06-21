import { boostExistingSuggestions, boostOrAddSuggestions, findChildContainingPosition } from '../utils'
import { getCannotFindCodes } from '../utils/cannotFindCodes'

const cannotFindCodes = getCannotFindCodes({ includeFromLib: true })

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
    const beforeConstNodeOffset = fileTextBeforePos.match(/(?:const|let) ([\w\d]*)$/i)?.[1]
    const nodeWithStatements = node => {
        return node && 'statements' in node && Array.isArray(node.statements) ? node : undefined
    }
    const statementsNode = nodeWithStatements(node) || nodeWithStatements(node.parent)
    // Workaround for current locality bonus & TS 5.1
    if (statementsNode) {
        const statements = statementsNode.statements as any[]
        const prevNode =
            statementsNode === node
                ? [...statements].reverse().find((statement: ts.Node) => statement.pos + statement.getLeadingTriviaWidth() < position)
                : statements[statements.indexOf(node) - 1]
        if (prevNode && ts.isVariableStatement(prevNode) && prevNode.declarationList.declarations.length === 1) {
            const { name } = prevNode.declarationList.declarations[0]!
            if (ts.isIdentifier(name)) {
                const kind: ts.ScriptElementKind =
                    prevNode.declarationList.flags & ts.NodeFlags.Const ? ts.ScriptElementKind.constElement : ts.ScriptElementKind.letElement
                entries = boostOrAddSuggestions(entries, [
                    {
                        name: name.text,
                        kind,
                    },
                ])
            }
        }
    }
    /** false - pick all identifiers after cursor
     * node - pick identifiers that within node */
    let filterBlock: undefined | false | ts.Node
    if (beforeConstNodeOffset !== undefined) {
        const node = findChildContainingPosition(ts, sourceFile, position - beforeConstNodeOffset.length - 2)
        if (!node || !ts.isVariableDeclarationList(node)) return entries
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

    if (filterBlock === undefined) return entries
    const semanticDiagnostics = languageService.getSemanticDiagnostics(sourceFile.fileName)

    const notFoundIdentifiers = semanticDiagnostics
        .filter(({ code }) => cannotFindCodes.includes(code))
        .filter(({ start, length }) => {
            if ([start, length].includes(undefined)) return false
            if (filterBlock === false) return true
            const diagnosticEnd = start! + length!
            const { pos, end } = filterBlock!
            if (start! < pos) return false
            if (diagnosticEnd > end) return false
            return true
        })
    const generalNotFoundNames = [...new Set(notFoundIdentifiers.map(({ start, length }) => fileText.slice(start, start! + length!)))]
    return boostOrAddSuggestions(
        entries,
        generalNotFoundNames.map(name => ({ name, kind: ts.ScriptElementKind.warning })),
    )

    function isFunction(node: ts.Node): node is ts.ArrowFunction | ts.FunctionDeclaration {
        if (!node) return false
        return ts.isArrowFunction(node) || ts.isFunctionDeclaration(node)
    }
}
