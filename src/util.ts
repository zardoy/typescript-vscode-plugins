import { offsetPosition } from '@zardoy/vscode-utils/build/position'
import ts from 'typescript'
import * as vscode from 'vscode'

export const tsRangeToVscode = (document: vscode.TextDocument, [start, end]: [number, number]) =>
    new vscode.Range(document.positionAt(start), document.positionAt(end))

export const tsRangeToVscodeSelection = (document: vscode.TextDocument, [start, end]: [number, number]) =>
    new vscode.Selection(document.positionAt(start), document.positionAt(end))

export const tsTextChangesToVcodeTextEdits = (document: vscode.TextDocument, edits: ts.TextChange[]): vscode.TextEdit[] => {
    return edits.map(({ span, newText }) => {
        const start = document.positionAt(span.start)
        return {
            range: new vscode.Range(start, offsetPosition(document, start, span.length)),
            newText,
        }
    })
}
