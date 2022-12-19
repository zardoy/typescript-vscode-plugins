import { compact } from '@zardoy/utils'
import { GetConfig } from '../types'

const isLibCompletion = (symbol: ts.Symbol) => {
    return symbol.declarations?.[0]?.getSourceFile().fileName.includes('node_modules/typescript/lib/')
}

export default (entries: ts.CompletionEntry[], position: number, languageService: ts.LanguageService, c: GetConfig) => {
    const action = c('removeOrMarkGlobalCompletions.action')
    if (action === 'disable') return

    return compact(
        entries.map(entry => {
            if (entry.sourceDisplay) return entry
            const symbol = entry['symbol'] as ts.Symbol | undefined
            if (!symbol) return entry
            if (!isLibCompletion(symbol)) return entry
            if (action === 'remove') return undefined
            return {
                ...entry,
                sourceDisplay: [
                    {
                        kind: 'text',
                        text: 'global',
                    },
                ],
            }
        }),
    )
}
