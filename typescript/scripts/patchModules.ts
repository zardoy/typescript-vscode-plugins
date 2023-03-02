import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const tsInternalsVersion = JSON.parse(await readFile('node_modules/ts-expose-internals/package.json', 'utf8')).version
const tsVersion = JSON.parse(await readFile('node_modules/typescript/package.json', 'utf8')).version
if (tsInternalsVersion !== tsVersion) {
    throw new Error(`Different versions of ts-expose-internals ${tsInternalsVersion} and typescript ${tsVersion} packages`)
}
console.log('Patching ts-expose-internals...')
const tsExposedInternalsFilePath = join(process.cwd(), 'node_modules/ts-expose-internals/typescript.d.ts')
let tsContents = await readFile(tsExposedInternalsFilePath, 'utf8')

tsContents = tsContents.replaceAll('declare module "typescript"', 'declare module "typescript-full"')

const useNativeInterfaces = [
    /* 'SourceFile', 'Node' */
]

for (const interfaceName of useNativeInterfaces) {
    const toInsertOverridePos = tsContents.indexOf(`export interface ${interfaceName} `)
    tsContents = tsContents.replaceAll(`interface ${interfaceName} `, `interface ExposedFull${interfaceName} `)
    if (toInsertOverridePos === -1) throw new Error(`Not found to insert override pos ${interfaceName}`)
    tsContents =
        tsContents.slice(0, toInsertOverridePos) +
        `type Provided${interfaceName} = import('typescript').${interfaceName}\ninterface ${interfaceName} extends Provided${interfaceName} {}\n` +
        tsContents.slice(toInsertOverridePos)
}

await writeFile(tsExposedInternalsFilePath, tsContents)
