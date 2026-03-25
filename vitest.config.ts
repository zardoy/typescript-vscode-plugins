import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        dir: 'typescript/test/',
        environment: 'ts-plugin',
    },
})
