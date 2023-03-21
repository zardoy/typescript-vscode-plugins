const _ = require('lodash')
const shared = require('eslint-config-zardoy')

const props = ['ignorePatterns', 'root']
const topLevelShared = _.pick(shared, props)
Object.assign(shared.rules, {
    curly: 'off',
    'import/no-deprecated': 'off',
})

// verbose solution to just eslint-plugin-disable plugin which doesn't work with eslint 8

/** @type {import('eslint').ESLint.ConfigData} */
const config = {
    overrides: [
        {
            files: 'src/**',
            // extends: 'zardoy',
            // ...shared,
        },
        {
            files: 'typescript/**',
            ..._.defaultsDeep(
                {
                    parserOptions: {
                        project: 'typescript/tsconfig.json',
                    },
                    rules: {
                        '@typescript-eslint/padding-line-between-statements': 'off',
                        'arrow-body-style': 'off',
                        'import/no-extraneous-dependencies': 'off',
                        complexity: 'off',
                    },
                },
                _.omit(shared, props),
            ),
            plugins: shared.plugins /* .filter(plugin => plugin !== 'import'), */,
        },
    ],
    ...topLevelShared,
}

module.exports = config
