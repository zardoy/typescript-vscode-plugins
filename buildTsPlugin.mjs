//@ts-check
import { ensureDir } from 'fs-extra'
import { build } from 'esbuild'
import { join, resolve } from 'path'
import { writePackageJsonFile } from 'typed-jsonfile'

export const buildTsPlugin = async (/** @type {string} */ outDir, /** @type {string} */ name, /** @type {string} */ entrypoint) => {
    outDir = resolve(outDir)
    entrypoint = resolve(entrypoint)
    await ensureDir(outDir)
    await writePackageJsonFile(
        { dir: outDir },
        {
            name,
            // TODO
            version: '0.0.0',
            main: 'index.js',
        },
    )
    await build({
        bundle: true,
        // TODO change to browser
        platform: 'node',
        treeShaking: true,
        format: 'cjs',
        entryPoints: [entrypoint],
        outfile: join(outDir, 'index.js'),
    })
}

const name = 'ts-essential-plugins'
buildTsPlugin(`out/node_modules/${name}`, name, 'typescript/src/index.ts')
