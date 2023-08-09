import { oneOf } from '@zardoy/utils'
import { matchParents } from '../utils'
import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    const { c, prevCompletionsMap } = sharedCompletionContext

    if (c('removeUselessFunctionProps.enable')) {
        entries = entries.filter(entry => {
            const completionDeclaration = entry.symbol?.valueDeclaration
            if (
                ['Symbol', 'caller', 'prototype'].includes(entry.name) &&
                !oneOf(entry.kind, ts.ScriptElementKind.warning) &&
                (entry.insertText === '[Symbol]' ||
                    (completionDeclaration?.getSourceFile().fileName.includes('node_modules/typescript/lib/lib') &&
                        matchParents(completionDeclaration.parent, ['InterfaceDeclaration'])?.name.text === 'Function'))
            ) {
                return false
            }
            return true
        })
    }

    const entryNames = new Set(entries.map(({ name, kind }) => (kind === ts.ScriptElementKind.warning ? '' : name)))
    if (['bind', 'call', 'apply', 'arguments'].every(name => entryNames.has(name)) && c('highlightNonFunctionMethods.enable')) {
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
