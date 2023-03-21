import { Statement } from 'typescript/lib/tsserverlibrary'
import { findChildContainingPosition, findClosestParent, getIndentFromPos } from '../../utils'
import { ApplyCodeAction, CodeAction } from '../getCodeActions'

const tryToApply: ApplyCodeAction = (sourceFile, pos, range) => {
    const currentNode = findChildContainingPosition(ts, sourceFile, pos)
    if (!currentNode) return
    const closestBlock = findClosestParent(
        currentNode,
        [
            ts.SyntaxKind.IfStatement,
            ts.SyntaxKind.ForStatement,
            ts.SyntaxKind.ForOfStatement,
            ts.SyntaxKind.ForInStatement,
            ts.SyntaxKind.WhileStatement,
            // ts.SyntaxKind.Block
        ],
        [],
    )
    if (!closestBlock) return
    let wrapNode: Statement | undefined
    if (ts.isForStatement(closestBlock) || ts.isForOfStatement(closestBlock) || ts.isForInStatement(closestBlock) || ts.isWhileStatement(closestBlock)) {
        wrapNode = closestBlock.statement
    } else if (ts.isIfStatement(closestBlock)) {
        wrapNode = closestBlock.thenStatement
    }
    if (wrapNode && !ts.isBlock(wrapNode)) {
        const startIndent = getIndentFromPos(ts, sourceFile, pos)
        return [
            { start: wrapNode.getStart(), length: 0, newText: `{\n${startIndent}\t` },
            { start: wrapNode.getEnd(), length: 0, newText: `\n${startIndent}}` },
        ]
    }
}

export default {
    name: 'Toggle Braces',
    id: 'toggleBraces',
    tryToApply,
} as CodeAction
