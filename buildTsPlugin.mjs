//@ts-check
import buildTsPlugin from '@zardoy/vscode-utils/build/buildTypescriptPlugin.js'
import fs from 'fs'

const enableWatch = process.argv.includes('--watch')

const result = await buildTsPlugin('typescript', undefined, undefined, {
    minify: !enableWatch,
    metafile: true,
    define: {
        'import.meta': '{}',
    },
    banner: {
        js: 'let ts, tsFull;',
    },
    external: ['perf_hooks', 'typescript', 'typescript/lib/tsserverlibrary'],
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
