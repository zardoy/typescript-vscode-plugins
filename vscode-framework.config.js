//@ts-check
const { defineConfig } = require('@zardoy/vscode-utils/build/defineConfig.cjs')
const { patchPackageJson } = require('@zardoy/vscode-utils/build/patchPackageJson.cjs')

patchPackageJson({
    patchSettings(configuration) {
        //prettier-ignore
        configuration['jsxPseudoEmmet.tags'].default = {
            div: true, span: true, input: "<input $1/>", p: true, form: true, footer: true, section: true, select: true, h1: true, h2: true, h3: true, h4: true, h5: true, h6: true,
        }
        return configuration
    },
})

module.exports = defineConfig({
    consoleStatements: process.argv.includes('--web') ? false : undefined,
    development: {},
    target: {
        web: true,
        desktop: true,
    },
})
