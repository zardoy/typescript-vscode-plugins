//@ts-check
import buildTsPlugin from '@zardoy/vscode-utils/build/buildTypescriptPlugin.js'
import { build, analyzeMetafile } from 'esbuild'
import fs from 'fs'

const enableWatch = process.argv.includes('--watch')
await build({
    bundle: true,
    external: ['typescript-essential-plugins'],
    // minify: !watch,
    watch: enableWatch,
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
    minify: !enableWatch,
    metafile: true,
    define: {
        'import.meta': '{}',
    },
    banner: {
        js: 'let ts, tsFull;',
        // js: 'const log = (...args) => console.log(...args.map(a => JSON.stringify(a)))',
    },
    plugins: [
        {
            name: 'watch-notifier',
            setup(build) {
                const writeStatus = (/** @type {number} */ signal) => {
                    fs.writeFileSync('./out/build_plugin_result', signal.toString())
                }
                build.onStart(() => {
                    writeStatus(0)
                })
                build.onEnd(({ errors }) => {
                    writeStatus(errors.length ? 2 : 1)
                })
            },
        },
    ],
})

// @ts-ignore
// console.log(await analyzeMetafile(result.metafile))
