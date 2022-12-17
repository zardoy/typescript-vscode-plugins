//@ts-check
import buildTsPlugin from '@zardoy/vscode-utils/build/buildTypescriptPlugin.js'
import { analyzeMetafile } from 'esbuild'

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
