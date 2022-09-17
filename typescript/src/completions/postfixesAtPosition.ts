import type tslib from 'typescript/lib/tsserverlibrary'
import { PostfixCompletion } from '../ipcTypes'
import { findChildContainingPosition, findClosestParent } from '../utils'

export default (position: number, fileName: string, scriptSnapshot: tslib.IScriptSnapshot, languageService: tslib.LanguageService): PostfixCompletion[] => {
    const { character } = languageService.toLineColumnOffset!(fileName, position)
    const startLinePos = position - character
    const textBeforePositionLine = scriptSnapshot?.getText(startLinePos, position + 1)
    const program = languageService.getProgram()
    const sourceFile = program?.getSourceFile(fileName)
    if (!textBeforePositionLine || !sourceFile) return []
    const dotIdx = textBeforePositionLine.lastIndexOf('.')
    if (dotIdx === -1) return []
    const nodePos = startLinePos + dotIdx - 1
    const node = findChildContainingPosition(ts, sourceFile, nodePos)
    if (!node) return []
    const postfixes: PostfixCompletion[] = []
    // undefined, null, eq
    // TODO doesn't include in case of ===
    let foundNode: tslib.Node | undefined
    if (
        ts.isIdentifier(node) &&
        (foundNode = findClosestParent(ts, node, [ts.SyntaxKind.BinaryExpression, ts.SyntaxKind.IfStatement], [])) &&
        (!ts.isBinaryExpression(foundNode!) || foundNode.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken)
    ) {
        if (ts.isIdentifier(node)) {
            postfixes.push(
                ...['undefined', 'null'].map((label): PostfixCompletion => {
                    return {
                        label,
                        insertText: ` === ${label}`,
                    }
                }),
            )
        }
        // hide after equality?
        postfixes.push({
            label: 'eq',
            insertText: ' === ',
        })
    }
    // if (ts.isBinaryExpression(node.parent?.parent)) {
    //     const binaryExprNode = node.parent.parent
    //     probablyAddNotSnippet(postfixes, binaryExprNode, ts)
    // }
    return postfixes
}

const probablyAddNotSnippet = (postfixes: PostfixCompletion[], binaryExprNode: tslib.BinaryExpression, ts: typeof tslib) => {
    let replaceOperator: string | undefined
    switch (binaryExprNode.operatorToken as any) {
        case ts.SyntaxKind.EqualsEqualsEqualsToken:
            replaceOperator = '!=='
            break
        case ts.SyntaxKind.EqualsEqualsToken:
            replaceOperator = '!='
            break
        case ts.SyntaxKind.ExclamationEqualsToken:
            replaceOperator = '=='
            break
        case ts.SyntaxKind.ExclamationEqualsEqualsToken:
            replaceOperator = '==='
            break

        default:
            break
    }
    if (!replaceOperator) return
    postfixes.push({
        label: 'not',
        // TODO! refactor. don't include in other cases (>)
        insertText: `${binaryExprNode.left.getText()} ${replaceOperator} ${binaryExprNode.right.getText()}`,
        // replacement: [binaryExprNode.getStart()],
    })
}
