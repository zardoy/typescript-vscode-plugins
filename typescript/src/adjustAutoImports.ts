import { GetConfig } from './types'
import { addObjectMethodResultInterceptors, findChildContainingExactPosition } from './utils'

let currentSymbolName: string | undefined

interface ParsedIgnoreSetting {
    module: string
    symbols: string[]
    isAnySymbol: boolean
    moduleCompare: 'startsWith' | 'strict'
}

// will be removed once I'm sure performance can't be improved
const initIgnoreAutoImport = () => {
    addObjectMethodResultInterceptors(tsFull, {
        // todo
        createPackageJsonImportFilter(res, fromFile) {
            return {
                ...res,
                allowsImportingAmbientModule(moduleSymbol, moduleSpecifierResolutionHost) {
                    return true
                    // return isModuleShouldBeIgnored(moduleSymbol.name.slice(1, -1), '')
                },
                // allowsImportingSourceFile(sourceFile, moduleSpecifierResolutionHost) {
                //     return false
                // },
                allowsImportingSpecifier(moduleSpecifier) {
                    const result = res.allowsImportingSpecifier(moduleSpecifier)
                    if (!result) return false
                    return false
                },
            }
        },
    })
    // addObjectMethodResultInterceptors(tsFull.codefix, {
    //     getAllFixes(res) {
    //         return res
    //     },
    // })
}

export const getIgnoreAutoImportSetting = (c: GetConfig) => {
    return c('suggestions.ignoreAutoImport').map((spec): ParsedIgnoreSetting => {
        const hashIndex = spec.indexOf('#')
        let module = hashIndex === -1 ? spec : spec.slice(0, hashIndex)
        const moduleCompare = module.endsWith('/*') ? 'startsWith' : 'strict'
        if (moduleCompare === 'startsWith') {
            module = module.slice(0, -'/*'.length)
        }
        if (hashIndex === -1) {
            return {
                module,
                symbols: [],
                isAnySymbol: true,
                moduleCompare,
            }
        }
        const symbolsString = spec.slice(hashIndex + 1)
        // * (glob asterisk) is reserved for future ussage
        const isAnySymbol = symbolsString === '*'
        return {
            module,
            symbols: isAnySymbol ? [] : symbolsString.split(','),
            isAnySymbol,
            moduleCompare,
        }
    })
}

export const isAutoImportEntryShouldBeIgnored = (ignoreAutoImportSetting: ParsedIgnoreSetting[], targetModule: string, symbol: string) => {
    for (const { module, moduleCompare, isAnySymbol, symbols } of ignoreAutoImportSetting) {
        const isIgnoreModule = moduleCompare === 'startsWith' ? targetModule.startsWith(module) : targetModule === module
        if (!isIgnoreModule) continue
        if (isAnySymbol) return true
        if (!symbols.includes(symbol)) continue
        return true
    }
    return false
}

export const shouldChangeSortingOfAutoImport = (symbolName: string, c: GetConfig) => {
    const arr = c('autoImport.changeSorting')[symbolName]
    return arr && arr.length > 0
}

export const changeSortingOfAutoImport = (c: GetConfig, symbolName: string): ((module: string) => number) => {
    const arr = c('autoImport.changeSorting')[symbolName]
    if (!arr || !arr.length) return () => 0
    const maxIndex = arr.length
    return module => {
        let actualIndex = arr.findIndex(x => {
            return x.endsWith('/*') ? module.startsWith(x.slice(0, -'/*'.length)) : module === x
        })
        // . - index, don't treat some node_modules-ignored modules as local such as `.vite`
        const isLocal = module.startsWith('./') || module.startsWith('../') || module === '.'
        if (actualIndex === -1) actualIndex = arr.findIndex(x => (isLocal ? x === '.' : x === '*'))
        return actualIndex === -1 ? maxIndex : actualIndex
    }
}
