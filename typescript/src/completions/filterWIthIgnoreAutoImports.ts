import _ from 'lodash'
import { changeSortingOfAutoImport, getIgnoreAutoImportSetting, isAutoImportEntryShouldBeIgnored, shouldChangeSortingOfAutoImport } from '../adjustAutoImports'
import { GetConfig } from '../types'
import { sortBy } from 'rambda'

export default (entries: ts.CompletionEntry[], languageService: ts.LanguageService, c: GetConfig) => {
    const ignoreAutoImportSetting = getIgnoreAutoImportSetting(c)

    let newEntries = entries.filter(({ sourceDisplay, name }) => {
        if (!sourceDisplay) return
        const targetModule = ts.displayPartsToString(sourceDisplay)
        const toIgnore = isAutoImportEntryShouldBeIgnored(ignoreAutoImportSetting, targetModule, name)
        return !toIgnore
    })
    // todo I'm not sure of incomplete completion (wasnt tested)
    // todo don't forget to impl glob there
    const handledSymbolNames = new Set<string>()
    for (const [i, entry] of newEntries.entries()) {
        const { name } = entry
        if (!entry.sourceDisplay || handledSymbolNames.has(name)) continue
        if (!shouldChangeSortingOfAutoImport(name, c)) continue
        handledSymbolNames.add(name)
        const sortFn = changeSortingOfAutoImport(c, name)
        // TODO probably should be rewrited
        const entriesToSort: ts.CompletionEntry[] = []
        newEntries = newEntries.filter((entry, k) => {
            if (k < i) return true
            if (entry.sourceDisplay && entry.name === name) {
                entriesToSort.push(entry)
                return false
            }
            return true
        })
        // todo rewrite outer that for loop to index based and increment here on insert length + handledSymbolNames can be removed in that case
        // final one seems to be slow, e.g. it might be slowing down completions
        newEntries.splice(i, 0, ...sortBy(({ sourceDisplay }) => sortFn(ts.displayPartsToString(sourceDisplay)), entriesToSort))
    }
    return newEntries
}
