import { compact } from '@zardoy/utils'
import type tslib from 'typescript/lib/tsserverlibrary'
import { Configuration } from '../../../src/configurationType'
import escapeStringRegexp from 'escape-string-regexp'

export default (
    ts: typeof tslib,
    entries: tslib.CompletionEntry[],
    node: tslib.Node,
    position: number,
    sourceFile: tslib.SourceFile,
    jsxCompletionsMap: Configuration['jsxCompletionsMap'],
): tslib.CompletionEntry[] => {
    // TODO refactor to findNodeAtPosition
    if (ts.isIdentifier(node)) node = node.parent
    if (ts.isJsxAttribute(node) && node.initializer) {
        entries = entries.map(entry => {
            return {
                ...entry,
                insertText: entry.name,
            }
        })
    }
    if (ts.isJsxAttribute(node)) node = node.parent
    if (ts.isJsxAttributes(node)) node = node.parent
    if (Object.keys(jsxCompletionsMap).length && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) {
        const tagName = node.tagName.getText()
        // TODO use the same perf optimization for replaceSuggestions
        const patchEntries: Record<number, Configuration['jsxCompletionsMap'][string]> = {}
        for (let [key, patchMethod] of Object.entries(jsxCompletionsMap)) {
            const splitTagNameIdx = key.indexOf('#')
            if (splitTagNameIdx === -1) continue
            const comparingTagName = key.slice(0, splitTagNameIdx)
            if (comparingTagName && comparingTagName !== tagName) continue
            const comparingName = key.slice(splitTagNameIdx + 1)
            if (comparingName.includes('*')) {
                const regexMatch = new RegExp(escapeStringRegexp(comparingName).replaceAll('\\*', '.*'))
                entries.forEach(({ name, kind }, index) => {
                    if (kind === ts.ScriptElementKind.memberVariableElement && regexMatch.test(name)) {
                        patchEntries[index] = patchMethod
                    }
                })
            } else {
                // I think it needs some sort of optimization by using wordRange
                const indexToPatch = entries.findIndex(({ name, kind }) => kind === ts.ScriptElementKind.memberVariableElement && name === comparingName)
                if (indexToPatch === -1) continue
                patchEntries[indexToPatch] = patchMethod
            }
        }
        entries = compact(
            entries.flatMap((entry, i) => {
                const patchMethod = patchEntries[i]
                if (patchMethod === undefined) return entry
                if (patchMethod === false) return
                const patchedEntry: tslib.CompletionEntry = { ...entry, insertText: entry.name + patchMethod.insertText, isSnippet: true }
                return patchMethod.duplicate ? [patchedEntry, entry] : patchedEntry
            }),
        )
    }
    return entries
}
