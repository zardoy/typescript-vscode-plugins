import { join } from 'path'
import glob from 'glob'
import Mocha from 'mocha'

export const run = async () => {
    const mocha = new Mocha({
        color: true,
        parallel: false,
        timeout: process.env.CI ? 4500 : 2000,
    })
    const testsRoot = join(__dirname, './suite')
    await new Promise<void>(resolve => {
        glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
            if (err) throw err

            const preFiles = [] as string[]
            const postFiles = ['outline.test.js'] as string[]

            for (const file of preFiles) {
                mocha.addFile(join(testsRoot, file))
            }

            for (const file of files.filter(file => !preFiles.includes(file) && !postFiles.includes(file))) {
                mocha.addFile(join(testsRoot, file))
            }

            for (const file of postFiles) {
                mocha.addFile(join(testsRoot, file))
            }

            mocha.run(failures => {
                if (failures > 0) {
                    console.error(`${failures} tests failed.`)
                    setImmediate(() => {
                        process.exit(1)
                    })
                } else {
                    resolve()
                }
            })
        })
    })
}
