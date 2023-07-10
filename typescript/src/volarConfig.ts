/* eslint-disable @typescript-eslint/no-require-imports */

import get from 'lodash/get'
import type { Configuration } from './types'

// will be required from ./node_modules/typescript-essential-plugins/index.js
const originalPluginFactory = require('typescript-essential-plugins')

const compact = <T>(arr: Array<T | undefined>): T[] => arr.filter(Boolean) as T[]

const plugin = ((context, { typescript: tsModule } = {}) => {
    if (!context) throw new Error('Not recieve context')
    const { typescript } = context
    let configurationHost = context.env
    if (context['configurationHost']) configurationHost = context['configurationHost']
    configurationHost = configurationHost['configurationHost'] ?? configurationHost
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

    if (typescript && configurationHost) {
        const ts = tsModule ?? typescript['module']
        const plugin = originalPluginFactory({
            typescript: ts,
        })
        const originalLsMethods = { ...typescript.languageService }

        const getResolvedUserConfig = async () => {
            const regularConfig = await configurationHost.getConfiguration!<any>('tsEssentialPlugins')
            const _vueSpecificConfig = (await configurationHost.getConfiguration!<any>('[vue]')) || {}

            const vueSpecificConfig = Object.fromEntries(
                compact(
                    Object.entries(_vueSpecificConfig).map(([key, value]) =>
                        key.startsWith('tsEssentialPlugins') ? [key.slice('tsEssentialPlugins.'.length), value] : undefined,
                    ),
                ),
            )
            const config: Configuration = mergeAndPatchConfig(regularConfig, vueSpecificConfig)
            return config
        }

        void getResolvedUserConfig().then(async config => {
            // if (typescript.languageService[thisPluginMarker]) return
            if (!config.enablePlugin) return
            const proxy = plugin.create({
                ...typescript,
                config,
                languageService: originalLsMethods,
            })
            console.log('TS Essentials Plugins activated!')
            // const methodToReassign = ['getCompletionsAtPosition', 'getCompletionEntryDetails']
            for (const method of Object.keys(proxy)) {
                typescript.languageService[method] = proxy[method]
            }
        })

        configurationHost.onDidChangeConfiguration!(() => {
            void getResolvedUserConfig().then(config => {
                plugin.onConfigurationChanged?.(config)
                // temporary workaround
                if (!config.enablePlugin) {
                    typescript.languageService = originalLsMethods
                }
            })
        })
        // typescript.languageService[thisPluginMarker] = true
    } else {
        console.warn('Failed to activate tsEssentialPlugins, because of no typescript or configurationHost context')
    }
    return {}
}) satisfies import('@vue/language-service').Service

module.exports = {
    services: {
        typescript: (...args) => {
            try {
                return plugin(...args)
            } catch (err) {
                console.log('TS Essentials error', err)
                return {}
            }
        },
    },
} satisfies import('@vue/language-service').Config
