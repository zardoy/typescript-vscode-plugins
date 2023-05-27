//@ts-check
const { defineConfig } = require('@zardoy/vscode-utils/build/defineConfig.cjs')
const { patchPackageJson } = require('@zardoy/vscode-utils/build/patchPackageJson.cjs')
const { mkdirSync, createWriteStream } = require('fs')
/** @type {any} */
const got = require('got-cjs')
const { promisify } = require('util')
const stream = require('stream')
const pipeline = promisify(stream.pipeline)

/**
 * @typedef {Record<keyof import('./src/configurationType').Configuration, any>} Config
 */

/** @type {(keyof Config)[]} */
const languageOveridableSettings = [
    'removeUselessFunctionProps.enable',
    'globalLibCompletions.action',
    'disableUselessHighlighting',
    'suggestions.keywordsInsertText',
    'caseSensitiveCompletions',
    'objectLiteralCompletions.moreVariants',
    'arrayMethodsSnippets.enable',
    'enableMethodSnippets',
    'removeImportsFromReferences',
    'removeDefinitionFromReferences',
    'removeCodeFixes.enable',
]

// settings that just doesn't make sense to make language-overridable
const dontMakeLanguageOverridableSettings = ['jsxPseudoEmmet.tags', 'jsxCompletionsMap', 'workspaceSymbolSearchExcludePatterns']

const ICON_URL = process.env.EXTENSION_ICON

patchPackageJson({
    patchSettings(/** @type {Config} */ configuration) {
        //prettier-ignore
        configuration['jsxPseudoEmmet.tags'].default = {
            div: true, span: true, input: "<input $1/>", p: true, form: true, footer: true, section: true, select: true, h1: true, h2: true, h3: true, h4: true, h5: true, h6: true,
        }
        // for (const key of languageOveridableSettings) {
        //     configuration[key].scope = 'language-overridable'
        // }
        // by default all arrays and objects are language-overridable (with exception of some settings)
        // for (const [key, config] of Object.entries(configuration)) {
        //     if (dontMakeLanguageOverridableSettings.includes(key)) continue
        //     if (config.type === 'array' || config.type === 'object') {
        //         config.scope = 'language-overridable'
        //     }
        // }
        return configuration
    },
    async rawPatchManifest(manifest) {
        if (ICON_URL) {
            mkdirSync('out/resources', { recursive: true })
            await pipeline(got.stream(ICON_URL), createWriteStream('out/resources/icon.png'))
            manifest.icon = 'resources/icon.png'
        }
    },
})

module.exports = defineConfig({
    consoleStatements: process.argv.includes('--web') ? false : undefined,
    target: {
        web: true,
        desktop: true,
    },
    extendPropsGenerators: [
        config => {
            //@ts-ignore
            config.generatedManifest.contributes.commands = config.generatedManifest.contributes.commands.map(({ ...args }) => ({
                ...args,
                category: args.category === 'TypeScript Essential Plugins' ? 'TS Essentials' : args.category,
            }))
            return config.generatedManifest
        },
    ],
})
