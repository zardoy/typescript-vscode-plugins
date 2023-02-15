//@ts-check
const { defineConfig } = require('@zardoy/vscode-utils/build/defineConfig.cjs')
const { patchPackageJson } = require('@zardoy/vscode-utils/build/patchPackageJson.cjs')

/**
 * @typedef {Record<keyof import('./src/configurationType').Configuration, any>} Config
 */

/** @type {(keyof Config)[]} */
const languageOveridableSettings = [
    'removeUselessFunctionProps.enable',
    'removeOrMarkGlobalLibCompletions.action',
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
})

module.exports = defineConfig({
    consoleStatements: process.argv.includes('--web') ? false : undefined,
    target: {
        web: true,
        desktop: true,
    },
})
