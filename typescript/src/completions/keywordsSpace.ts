export default (entries: ts.CompletionEntry[], scriptSnapshot: ts.IScriptSnapshot, position: number, node: ts.Node | undefined) => {
    const charAhead = scriptSnapshot.getText(position, position + 1)
    if (charAhead === ' ') return entries
    const bannedKeywords = [
        'true',
        'false',
        'undefined',
        'null',
        'never',
        'unknown',
        'any',
        'symbol',
        'string',
        'number',
        'boolean',
        'object',
        'this',
        'catch',
        'constructor',
        'continue',
        'break',
        'debugger',
        'super',
        'import',
    ]
    const bannedKeywordsWhenInType = ['const', 'void', 'import']
    const inType = node && isTypeNode(node)

    const fileText = scriptSnapshot.getText(0, position)
    const textBeforeWord = fileText.slice(0, /[\w\d]*$/i.exec(fileText)!.index)

    const defaultSpaceValidBeforeContent = ['export ', '@']
    const includeDefaultSpace = defaultSpaceValidBeforeContent.some(str => textBeforeWord.endsWith(str))
    return entries.map(entry => {
        if (entry.kind !== ts.ScriptElementKind.keyword || bannedKeywords.includes(entry.name) || (inType && bannedKeywordsWhenInType.includes(entry.name))) {
            return entry
        }
        if (entry.name === 'default' && !includeDefaultSpace) return entry
        return { ...entry, insertText: `${entry.name} ` }
    })
}

export const isTypeNode = (node: ts.Node) => {
    if (ts.isTypeNode(node)) {
        // built-in types
        return true
    }

    if (inTypeReference(node)) return true

    return false

    function inTypeReference(node: ts.Node) {
        if (ts.isTypeReferenceNode(node)) {
            return true
        }

        return node.parent && inTypeReference(node.parent)
    }
}
