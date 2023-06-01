//@ts-check
import buildTsPlugin from '@zardoy/vscode-utils/build/buildTypescriptPlugin.js'
import { build, analyzeMetafile } from 'esbuild'

await build({
    bundle: true,
    external: ['typescript-essential-plugins'],
    // minify: !watch,
    entryPoints: ['./typescript/src/volarConfig.ts'],
    outfile: './out/volarConfig.js',
    format: 'cjs',
    logLevel: 'info',
    platform: 'node',
    // banner: {
    //     js: 'let ts, tsFull;',
    // },
    // treeShaking: true,
})

const result = await buildTsPlugin('typescript', undefined, undefined, {
    minify: !process.argv.includes('--watch'),
    metafile: true,
    define: {
        'import.meta': '{}',
    },
    banner: {
        js: 'let ts, tsFull;',
        // js: 'const log = (...args) => console.log(...args.map(a => JSON.stringify(a)))',
    },
})

// @ts-ignore
// console.log(await analyzeMetafile(result.metafile))
