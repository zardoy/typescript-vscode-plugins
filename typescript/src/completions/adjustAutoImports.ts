import { sortBy } from 'rambda'
import { changeSortingOfAutoImport, getIgnoreAutoImportSetting, isAutoImportEntryShouldBeIgnored, shouldChangeSortingOfAutoImport } from '../adjustAutoImports'
import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    const { c } = sharedCompletionContext

    const ignoreAutoImportsSetting = getIgnoreAutoImportSetting(c)

    const ignoreKinds = [ts.ScriptElementKind.warning, ts.ScriptElementKind.string]
    entries = entries.filter(({ sourceDisplay, name, kind }) => {
        if (!sourceDisplay || ignoreKinds.includes(kind)) return true
        const importModule = ts.displayPartsToString(sourceDisplay)
        const toIgnore = isAutoImportEntryShouldBeIgnored(ignoreAutoImportsSetting, importModule, name)
        return !toIgnore
    })
    // todo I'm not sure of incomplete completion (wasnt tested)
    // todo don't forget to impl glob there
    const handledSymbolNames = new Set<string>()
    for (const [i, entry] of entries.entries()) {
        const { name } = entry
        if (!entry.sourceDisplay || handledSymbolNames.has(name)) continue
        if (!shouldChangeSortingOfAutoImport(name, c)) continue
        handledSymbolNames.add(name)
        const sortFn = changeSortingOfAutoImport(c, name)
        // TODO probably should be rewrited
        const entriesToSort: ts.CompletionEntry[] = []
        entries = entries.filter((entry, k) => {
            if (k < i) return true
            if (entry.sourceDisplay && entry.name === name) {
                entriesToSort.push(entry)
                return false
            }
            return true
        })
        // todo rewrite outer that for loop to index based and increment here on insert length + handledSymbolNames can be removed in that case
        // final one seems to be slow, e.g. it might be slowing down completions
        entries.splice(i, 0, ...sortBy(({ sourceDisplay }) => sortFn(ts.displayPartsToString(sourceDisplay)), entriesToSort))
    }

    return entries
}
