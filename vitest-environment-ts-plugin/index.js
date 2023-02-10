/** @type {import('vitest').Environment} */
module.exports = {
    name: 'vitest-environment-ts-plugin',
    setup() {
        globalThis.__WEB__ = false
        globalThis.ts = globalThis.tsFull = require('typescript/lib/tsserverlibrary')
        return {
            teardown() {},
        }
    },
}
