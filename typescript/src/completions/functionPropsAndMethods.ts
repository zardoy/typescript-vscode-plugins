import { oneOf } from '@zardoy/utils'
import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    const { c, prevCompletionsMap } = sharedCompletionContext

    if (c('removeUselessFunctionProps.enable')) {
        entries = entries.filter(entry => {
            if (oneOf(entry.kind, ts.ScriptElementKind.warning)) return true
            return !['Symbol', 'caller', 'prototype'].includes(entry.name)
        })
    }

    const entryNames = new Set(entries.map(({ name, kind }) => (kind === ts.ScriptElementKind.warning ? '' : name)))
    if (['bind', 'call', 'caller'].every(name => entryNames.has(name)) && c('highlightNonFunctionMethods.enable')) {
        const standardProps = new Set(['Symbol', 'apply', 'arguments', 'bind', 'call', 'caller', 'length', 'name', 'prototype', 'toString'])
        entries = entries.map(entry => {
            if (!standardProps.has(entry.name) && entry.kind !== ts.ScriptElementKind.warning) {
                const newName = `☆${entry.name}`
                prevCompletionsMap[newName] = {
                    originalName: entry.name,
                }
                return {
                    ...entry,
                    insertText: entry.insertText ?? entry.name,
                    name: newName,
                }
            }

            return entry
        })
    }
    return entries
}
