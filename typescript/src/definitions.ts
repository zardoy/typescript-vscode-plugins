import type tslib from 'typescript/lib/tsserverlibrary'
import { GetConfig } from './types'

export default (proxy: tslib.LanguageService, info: tslib.server.PluginCreateInfo, c: GetConfig) => {
    proxy.getDefinitionAndBoundSpan = (fileName, position) => {
        const prior = info.languageService.getDefinitionAndBoundSpan(fileName, position)
        if (!prior) return
        // used after check
        const firstDef = prior.definitions![0]!
        if (
            c('changeDtsFileDefinitionToJs') &&
            prior.definitions?.length === 1 &&
            // default, namespace import or import path click
            firstDef.containerName === '' &&
            firstDef.fileName.endsWith('.d.ts')
        ) {
            const jsFileName = `${firstDef.fileName.slice(0, -'.d.ts'.length)}.js`
            const isJsFileExist = info.languageServiceHost.fileExists?.(jsFileName)
            if (isJsFileExist) prior.definitions = [{ ...firstDef, fileName: jsFileName }]
        }
        if (c('miscDefinitionImprovement') && prior.definitions?.length === 2) {
            prior.definitions = prior.definitions.filter(({ fileName, containerName }) => {
                const isFcDef = fileName.endsWith('node_modules/@types/react/index.d.ts') && containerName === 'FunctionComponent'
                return !isFcDef
            })
        }
        return prior
    }
}
