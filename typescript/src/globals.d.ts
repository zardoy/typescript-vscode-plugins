import('ts-expose-internals')
// prvided by esbuild at top-level of bundle in buildTsPlugin.mjs
declare let tsFull: typeof import('typescript-full')

declare type FullChecker = import('typescript-full').TypeChecker
declare type FullSourceFile = import('typescript-full').SourceFile

declare let __WEB__: boolean
