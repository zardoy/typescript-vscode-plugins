//@ts-check
/** @type {import('vitest').Environment} */
const env = {
    name: 'vitest-environment-ts-plugin',
    setup() {
        globalThis.__WEB__ = false
        globalThis.ts = globalThis.tsFull = require('typescript/lib/tsserverlibrary')
        return {
            teardown() {},
        }
    },
    transformMode: 'web',
}

module.exports = env
