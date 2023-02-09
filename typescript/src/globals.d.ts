import('ts-expose-internals')
// prvided by esbuild at top-level of bundle in buildTsPlugin.mjs
declare let ts: typeof import('typescript')
declare let tsFull: typeof import('typescript-full')

declare type FullChecker = import('typescript-full').TypeChecker
declare type FullSourceFile = import('typescript-full').SourceFile

// declare type ts = import('typescript')
// export {}
// export * from 'typescript'
// // export * from 'typescript/lib/tsserverlibrary'

// export as namespace ts
// declare global {
//     export as namespace ts
//     declare let ts: typeof import('typescript')
// }

declare let __WEB__: boolean
