import { compact } from '@zardoy/utils'
import { GetConfig } from '../types'
import { basename } from 'path-browserify'

const isLibCompletion = (symbol: ts.Symbol) => {
    const fileName = symbol.declarations?.[0]?.getSourceFile().fileName
    if (!fileName) return
    if (!fileName.includes('node_modules/typescript/lib/')) return
    return basename(fileName).slice(0, -'.d.ts'.length)
}

export default (entries: ts.CompletionEntry[], position: number, languageService: ts.LanguageService, c: GetConfig) => {
    const action = c('removeOrMarkGlobalLibCompletions.action')
    if (action === 'disable') return

    return compact(
        entries.map(entry => {
            if (entry.sourceDisplay) return entry
            const symbol = entry['symbol'] as ts.Symbol | undefined
            if (!symbol) return entry
            const libCompletionEnding = isLibCompletion(symbol)
            if (!libCompletionEnding) return entry
            if (action === 'remove') return undefined
            return {
                ...entry,
                sourceDisplay: [
                    {
                        kind: 'text',
                        text: libCompletionEnding,
                    },
                ],
            }
        }),
    )
}
