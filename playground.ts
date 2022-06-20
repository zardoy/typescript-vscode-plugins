//@ts-check
import ts from 'typescript/lib/tsserverlibrary'
import { createLanguageService } from './typescript/src/dummyLanguageService'

const test = (arg: {}) => arg
test({})

let testString = /* ts */ `
const test = {/**/}

import {commands} from 'vscode'
/*
 * @deprecated
 */
const test/**/ = 5
test
commands.executeCommand('/**/')
`
const replacement = '/**/'
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
const node = findChildContainingPosition(ts, sourceFile, pos)
if (!node) throw new Error('No node')

const updateJsdocDefault = () => {
    const checkNode = ts.isStringLiteralLike(node) ? node.parent : node
    return ts.isBindingElement(checkNode)
}

const suggestJsdocDefault = () => {
    const checkNode = ts.isStringLiteralLike(node) ? node.parent : node
    if (
        ts.isBindingElement(checkNode) ||
        (ts.isBinaryExpression(checkNode) && checkNode.operatorToken.kind === ts.SyntaxKind.EqualsToken) ||
        ts.isObjectLiteralExpression(checkNode)
        ts.isPropertyAssignment(checkNode)
    ) {
    }
}

// ts.TypeFlags.Enum
// languageService.getQuickInfoAtPosition(fileName, position)

// explore:

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
