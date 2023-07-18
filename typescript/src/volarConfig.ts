/* eslint-disable @typescript-eslint/no-require-imports */

import get from 'lodash/get'
import type { Configuration } from './types'

// will be required from ./node_modules/typescript-essential-plugins/index.js
const originalPluginFactory: typeof import('./index') = require('typescript-essential-plugins')

const compact = <T>(arr: Array<T | undefined>): T[] => arr.filter(Boolean) as T[]

const plugin: (...args: Parameters<import('@vue/language-service').Service>) => Promise<void> = async (context, { typescript: tsModule } = {}) => {
    if (!context) {
        console.warn('Skipping activation of tsEssentialPlugins for now, because of no context.')
        return
    }
    if (!tsModule) throw new Error('typescript module is missing!')
    await new Promise(resolve => {
        if (context.services.typescript) {
            resolve()
        } else {
            context.services = new Proxy(context.services, {
                set(target, p, newValue, receiver) {
                    Reflect.set(target, p, newValue, receiver)
                    if (p === 'typescript') {
                        resolve()
                    }
                    return true
                },
            })
        }
    })
    const typescriptService = context.services.typescript!
    const languageService = typescriptService.provide['typescript/languageService']()
    const languageServiceHost = typescriptService.provide['typescript/languageServiceHost']()
    const configurationHost = context.env
    const mergeAndPatchConfig = (generalConfig, vueConfig) => {
        const mergedConfig = {
            ...generalConfig,
            ...Object.fromEntries(
                Object.entries(vueConfig).map(([key, value]) => {
                    const getType = obj => {
                        return Array.isArray(obj) ? 'array' : typeof obj === 'object' && obj !== null ? 'object' : undefined
                    }
                    const type = getType(value)
                    if (!type || vueConfig['resetSettings']?.includes(key)) return [key, value]
                    const generalConfigValue = get(generalConfig, key)
                    const generalValueType = getType(generalConfigValue)
                    if (type !== generalValueType) return [key, value]
                    return [key, generalValueType === 'object' ? { ...generalConfigValue, ...value } : [...generalConfigValue, ...value]]
                }),
            ),
        }

        return {
            ...mergedConfig,
            _additionalPluginOptions: {
                pluginSpecificSyntaxServerConfigCheck: false,
            },
            enablePlugin: generalConfig.enableVueSupport,
        }
    }

    const plugin = originalPluginFactory({
        typescript: tsModule,
    })
    const originalLanguageService = { ...languageService }

    const getResolvedUserConfig = async () => {
        const regularConfig = await configurationHost.getConfiguration!<any>('tsEssentialPlugins')
        const editorSuggestInsertModeReplace = (await configurationHost.getConfiguration!<any>('editor.suggest.insertMode')) === 'replace'
        const _vueSpecificConfig = (await configurationHost.getConfiguration!<any>('[vue]')) || {}

        const vueSpecificConfig = Object.fromEntries(
            compact(
                Object.entries(_vueSpecificConfig).map(([key, value]) =>
                    key.startsWith('tsEssentialPlugins') ? [key.slice('tsEssentialPlugins.'.length), value] : undefined,
                ),
            ),
        )
        const config: Configuration = { ...mergeAndPatchConfig(regularConfig, vueSpecificConfig), editorSuggestInsertModeReplace }
        return config
    }

    let config = await getResolvedUserConfig()
    // if (typescript.languageService[thisPluginMarker]) return
    const proxy = plugin.create({
        languageServiceHost,
        config,
        languageService: originalLanguageService,
    })

    const activatePlugin = () => {
        if (!config.enableVueSupport) return
        Object.assign(languageService, proxy)
        console.log('TS Essentials Plugins activated!')
        // typescript.languageService[thisPluginMarker] = true
    }

    const deactivatePlugin = () => {
        Object.assign(languageService, originalLanguageService)
        console.log('TS Essentials Plugins deactivated!')
    }

    configurationHost.onDidChangeConfiguration!(async () => {
        const prevConfig = config
        config = await getResolvedUserConfig()
        if (prevConfig.enableVueSupport !== config.enableVueSupport) {
            if (config.enableVueSupport) {
                activatePlugin()
            } else {
                deactivatePlugin()
            }
        }
        plugin.onConfigurationChanged?.(config)
    })

    activatePlugin()
}

module.exports = {
    services: {
        typescriptEssentialPlugins: (...args) => {
            ;(async () => {
                try {
                    await plugin(...args)
                } catch (err) {
                    console.log('TS Essentials error', err)
                }
            })()
            return {}
        },
    },
} satisfies import('@vue/language-service').Config
