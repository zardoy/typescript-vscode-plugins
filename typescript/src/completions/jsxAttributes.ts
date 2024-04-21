import { compact } from '@zardoy/utils'
import escapeStringRegexp from 'escape-string-regexp'
import { Configuration } from '../../../src/configurationType'
import { collectLocalSymbols } from '../utils'
import { sharedCompletionContext } from './sharedContext'

export default (
    entries: ts.CompletionEntry[],
    node: ts.Node,
    position: number,
    sourceFile: ts.SourceFile,
    jsxCompletionsMap: Configuration['jsxCompletionsMap'],
): ts.CompletionEntry[] => {
    const originalNode = node
    // ++ patch with jsxCompletionsMap
    // -- don't
    // <div| - identifier, not attribute --
    // <div | - not identifier, not attribute ++
    // <div t| - identifier -> attribute ++
    // <div a={} t={} - in attributes ++
    // <div t={|} - isn't attribute, so doesn't matter --
    let jsxAttributeCandidate = !ts.isIdentifier(node)
    if (ts.isIdentifier(node)) node = node.parent
    // fix builtin jsx attribute completion
    if (ts.isJsxAttribute(node) && node.initializer) {
        entries = entries.map(entry => {
            return {
                ...entry,
                insertText: entry.name,
            }
        })
    }
    if (ts.isJsxAttribute(node)) {
        jsxAttributeCandidate = true
        node = node.parent
    }
    if (ts.isJsxAttributes(node)) {
        jsxAttributeCandidate = true
        node = node.parent
    }
    if (jsxAttributeCandidate && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) {
        if (sharedCompletionContext.c('improveJsxCompletions') && Object.keys(jsxCompletionsMap).length > 0) {
            const tagName = node.tagName.getText()
            // TODO use the same perf optimization for replaceSuggestions
            const patchEntries: Record<number, Configuration['jsxCompletionsMap'][string]> = {}
            for (const [key, patchMethod] of Object.entries(jsxCompletionsMap)) {
                const splitTagNameIdx = key.indexOf('#')
                if (splitTagNameIdx === -1) continue
                const comparingTagName = key.slice(0, splitTagNameIdx)
                if (comparingTagName && comparingTagName !== tagName) continue
                const comparingName = key.slice(splitTagNameIdx + 1)
                if (comparingName.includes('*')) {
                    const regexMatch = new RegExp(`^${escapeStringRegexp(comparingName).replaceAll('\\*', '.*')}$`)
                    for (const [index, { name, kind }] of entries.entries()) {
                        if (kind === ts.ScriptElementKind.memberVariableElement && regexMatch.test(name)) {
                            patchEntries[index] = patchMethod
                        }
                    }
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
                    const patchedEntry: ts.CompletionEntry = { ...entry, insertText: entry.name + patchMethod.insertText, isSnippet: true }
                    const { keepOriginal } = patchMethod
                    if (!keepOriginal) return patchedEntry
                    return keepOriginal === 'above' ? [entry, patchedEntry] : [patchedEntry, entry]
                }),
            )
        }

        const enableJsxAttributesShortcuts = sharedCompletionContext.c('jsxAttributeShortcutCompletions.enable')
        if (enableJsxAttributesShortcuts !== 'disable') {
            const locals = collectLocalSymbols(node, sharedCompletionContext.typeChecker)
            let attrib = originalNode.parent as ts.JsxAttribute | undefined
            if (!ts.isJsxAttribute(attrib!)) {
                attrib = undefined
            }
            entries = entries.flatMap(entry => {
                if (locals.includes(entry.name)) {
                    const insertText = `${entry.name}={${entry.name}}`
                    const pos = attrib ? attrib.end - attrib.getWidth() : 0
                    const additionalSuggestions: ts.CompletionEntry = {
                        ...entry,
                        name: insertText,
                        insertText,
                        replacementSpan: attrib
                            ? {
                                  start: pos,
                                  length: attrib.end - pos,
                              }
                            : undefined,
                    }
                    return enableJsxAttributesShortcuts === 'after' ? [entry, additionalSuggestions] : [additionalSuggestions, entry]
                }
                return entry
            })
        }
    }

    return entries
}
