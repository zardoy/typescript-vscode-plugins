//@ts-check
import ts from 'typescript/lib/tsserverlibrary'
import { createLanguageService } from './typescript/src/dummyLanguageService'

let testString = 'const a: {/** @default test */a: 5} | {b: 6, /** yes */a: 9} = null as any;\nif ("||" in a) {}'
const replacement = '||'
const pos = testString.indexOf(replacement)
testString = testString.slice(0, pos) + testString.slice(pos + replacement.length)
const filePath = '/test.ts'
const languageService = createLanguageService({
    [filePath]: testString,
})

const program = languageService.getProgram()
const sourceFile = program?.getSourceFile(filePath)
if (!program || !sourceFile) throw new Error('No source file')

const typeChecker = program.getTypeChecker()
const node = findChildContainingPosition(ts, sourceFile, pos)
if (!node) throw new Error('No node')
const type = typeChecker.getTypeAtLocation(node)

// explore:

console.log(typeChecker.typeToString(type))

function findChildContainingPosition(
    typescript: typeof import('typescript/lib/tsserverlibrary'),
    sourceFile: ts.SourceFile,
    position: number,
): ts.Node | undefined {
    function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.getStart() && position < node.getEnd()) return typescript.forEachChild(node, find) || node

        return
    }
    return find(sourceFile)
}
