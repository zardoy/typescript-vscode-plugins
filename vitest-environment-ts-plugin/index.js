//@ts-check
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** @type {import('vitest/runtime').Environment} */
const env = {
    name: 'vitest-environment-ts-plugin',
    setup() {
        globalThis.__WEB__ = false
        globalThis.ts = globalThis.tsFull = require('typescript/lib/tsserverlibrary')
        return {
            teardown() {},
        }
    },
    viteEnvironment: 'client',
}

export default env
