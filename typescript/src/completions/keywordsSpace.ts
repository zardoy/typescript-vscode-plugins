export default (entries: ts.CompletionEntry[], scriptSnapshot: ts.IScriptSnapshot, position: number, node) => {
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
        'default',
        'super',
        'import',
    ]
    const bannedKeywordsWhenInType = ['const', 'void', 'import']
    const inType = isTypeNode(node)
    return entries.map(entry => {
        if (entry.kind !== ts.ScriptElementKind.keyword || bannedKeywords.includes(entry.name) || (inType && bannedKeywordsWhenInType.includes(entry.name)))
            return entry
        return { ...entry, insertText: `${entry.name} ` }
    })
}

const isTypeNode = (node: ts.Node) => {
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
