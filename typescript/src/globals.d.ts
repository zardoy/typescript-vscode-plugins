/// <reference types="ts-expose-internals" />

// Runtime globals provided by esbuild banner in buildTsPlugin.mjs
// Type annotations come from explicit imports in each file
declare global {
    // Runtime variable declarations - these are assigned in index.ts and libMethods.ts
    // eslint-disable-next-line no-var
    var ts: typeof import('typescript/lib/tsserverlibrary')
    // eslint-disable-next-line no-var
    var tsFull: typeof import('typescript-full')
    // eslint-disable-next-line no-var
    var __WEB__: boolean

    type FullChecker = import('typescript-full').TypeChecker
    type FullSourceFile = import('typescript-full').SourceFile
}

export {}
