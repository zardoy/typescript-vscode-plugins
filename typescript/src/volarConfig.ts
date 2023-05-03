/* eslint-disable @typescript-eslint/no-require-imports */
// will be required from ./node_modules/typescript-essential-plugins/index.js
const originalPluginFactory = require('typescript-essential-plugins')

const plugin = ((context, { typescript: tsModule } = {}) => {
    if (!context) throw new Error('Not recieve context')
    const { typescript } = context
    let configurationHost = context.env
    if (context['configurationHost']!) configurationHost = context['configurationHost']!
    const patchConfig = config => {
        return {
            ...config,
            _additionalPluginOptions: {
                pluginSpecificSyntaxServerConfigCheck: false,
            },
            enablePlugin: config.enableVueSupport,
        }
    }

    if (typescript && configurationHost) {
        const ts = tsModule ?? typescript['module']
        const plugin = originalPluginFactory({
            typescript: ts,
        })
        // todo support vue-specific settings
        const originalLsMethods = { ...typescript.languageService }

        void configurationHost.getConfiguration!<any>('tsEssentialPlugins').then(_configuration => {
            // if (typescript.languageService[thisPluginMarker]) return
            const config = patchConfig(_configuration)
            if (!config.enablePlugin) return
            const proxy = plugin.create({
                ...typescript,
                config,
                languageService: originalLsMethods as any,
            } as any)
            console.log('TS Essentials Plugins activated!')
            // const methodToReassign = ['getCompletionsAtPosition', 'getCompletionEntryDetails']
            for (const method of Object.keys(proxy)) {
                typescript.languageService[method] = proxy[method]
            }
        })

        configurationHost.onDidChangeConfiguration!(() => {
            void configurationHost.getConfiguration!<any>('tsEssentialPlugins').then(config => {
                config = patchConfig(config)
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
}) satisfies import('@volar/language-service').Service

module.exports = {
    plugins: [
        (...args) => {
            try {
                return plugin(...(args as [any]))
            } catch (err) {
                console.log('TS Essentials error', err)
                return {}
            }
        },
    ],
} /*  satisfies import('@volar/language-service').ServiceContext */
