import { approveCast } from '../utils'

export default (entries: ts.CompletionEntry[], node: ts.Node, languageService: ts.LanguageService): ts.CompletionEntry[] | void => {
    if (entries.length && node) {
        if (ts.isStringLiteralLike(node) && approveCast(node.parent, ts.isPropertyAssignment) && ts.isObjectLiteralExpression(node.parent.parent)) {
            const typeChecker = languageService.getProgram()!.getTypeChecker()!
            const type = typeChecker.getContextualType(node.parent.parent)
            if (type) {
                const properties = type.getProperties()
                const propName = node.parent.name.getText()
                const completingPropName = properties.find(({ name }) => name === propName)
                const defaultValue = completingPropName?.getJsDocTags().find(({ name, text }) => name === 'default' && text?.length)?.text?.[0]?.text
                if (defaultValue) {
                    const entryIndex = entries.findIndex(({ name, kind }) => name === defaultValue && kind === ts.ScriptElementKind.string)
                    if (entryIndex === -1) return
                    const entry = entries[entryIndex]!
                    const newEntries = [...entries]
                    newEntries.splice(entryIndex, 1, { ...entry, sortText: `z${entry.sortText}`, sourceDisplay: [{ kind: 'text', text: 'Default' }] })
                    return newEntries
                }
            }
        }
    }
}
