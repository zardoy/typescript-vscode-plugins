//@ts-check
import ts from 'typescript/lib/tsserverlibrary'
import { createLanguageService } from './typescript/src/dummyLanguageService'

globalThis.ts = ts

let testString = /* ts */ `
const b = () => 5
const a = b()|| as
new Promise()
`
const replacement = '||'
const pos = testString.indexOf(replacement)
testString = testString.slice(0, pos) + testString.slice(pos + replacement.length)
const filePath = '/test.ts'
const { languageService } = createLanguageService({
    [filePath]: testString,
})

const program = languageService.getProgram()
const sourceFile = program?.getSourceFile(filePath)
if (!program || !sourceFile) throw new Error('No source file')

const typeChecker = program.getTypeChecker()
let node = findChildContainingPosition(ts, sourceFile, pos)
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
