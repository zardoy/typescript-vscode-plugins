//@ts-check
import buildTsPlugin from '@zardoy/vscode-utils/build/buildTypescriptPlugin.js'

const watch = process.argv[2] === '--watch'
await buildTsPlugin('typescript', undefined, undefined, {
    watch,
    logLevel: 'info',
    sourcemap: watch,
    // banner: {
    //     js: 'const log = (...args) => console.log(...args.map(a => JSON.stringify(a)))',
    // },
})
