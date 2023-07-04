import { matchParents, buildNotStrictStringCompletion } from '../utils'
import { sharedCompletionContext } from './sharedContext'

export default (): ts.CompletionEntry[] | void => {
    const { node, program } = sharedCompletionContext
    if (!node) return
    const comparisonNode = getComparisonNode(node)
    if (!comparisonNode) return
    if (ts.isPropertyAccessExpression(comparisonNode) && ts.isIdentifier(comparisonNode.name) && comparisonNode.name.text === 'code') {
        const typeChecker = program.getTypeChecker()
        const symbol = typeChecker.getSymbolAtLocation(comparisonNode.name)
        const decl = symbol?.declarations?.[0]
        if (!decl) return
        if (
            decl.getSourceFile().fileName.endsWith('node_modules/typescript/lib/lib.dom.d.ts') &&
            matchParents(decl.parent, ['InterfaceDeclaration'])?.name.text === 'KeyboardEvent'
        ) {
            return allKeyCodes.map(keyCode => buildNotStrictStringCompletion(node as ts.StringLiteralLike, keyCode))
        }
    }
}

// type: https://github.com/zardoy/contro-max/blob/master/src/types/keyCodes.ts
const singleNumber = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const fNumbers = [...singleNumber.filter(x => x !== 0), 10, 11, 12].map(x => `F${x}`) // actually can go up to 24, but used rarely
const letterKeys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'].map(
    x => `Key${x.toUpperCase()}`,
)
const someOtherKeys = [
    'Space',
    'Esc',
    'Tab',
    'Enter',
    'Equal',
    'Minus',
    'Backslash',
    'Slash',
    'Period',
    'Comma',
    'Capslock',
    'Numlock',
    'PrintScreen',
    'Scrolllock',
    'Pause',
    'Backspace',
    'Delete',
    'Insert',
    'Backquote',
    'BracketLeft',
    'BracketRight',
    ...['Up', 'Down', 'Left', 'Right'].map(x => `Arrow${x}`),
    'Home',
    'End',
    'PageUp',
    'PageDown',
]

const digitKeys = singleNumber.map(x => `Digit${x}`)
const modifierOnlyKeys = ['Meta', 'Control', 'Alt', 'Shift'].flatMap(x => ['', 'Left', 'Right'].map(j => x + j))

const numpadKeys = [...singleNumber, 'Divide', 'Multiply', 'Subtract', 'Add', 'Enter', 'Decimal'].map(x => `Numpad${x}`)
const allKeyCodes = [...digitKeys, ...letterKeys, ...fNumbers, ...someOtherKeys, ...modifierOnlyKeys, ...numpadKeys]

const getComparisonNode = (node: ts.Node) => {
    if (!ts.isStringLiteralLike(node)) return
    const binaryExpr = matchParents(node.parent, ['BinaryExpression'])
    return binaryExpr?.right === node &&
        [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(binaryExpr.operatorToken.kind)
        ? binaryExpr.left
        : matchParents(node.parent, ['CaseClause', 'CaseBlock', 'SwitchStatement'])?.expression
}
