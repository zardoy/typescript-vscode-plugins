import * as vscode from 'vscode'
import delay from 'delay'

import { expect } from 'chai'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
import { fromFixtures, replaceEditorText } from './utils'

describe.only('Completions', () => {
    // throw new Error('111')
    const editor = () => vscode.window.activeTextEditor!

    const startPos = new vscode.Position(0, 0)
    before(async function () {
        this.timeout(3000)
        await vscode.workspace.getConfiguration('typescript').update('tsserver.log', 'verbose', vscode.ConfigurationTarget.Global)
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fromFixtures('test-project/src/completions.ts')))
        // prepare TS completions
        await delay(800)
        // await vscode.commands.executeCommand('typescript.openTsServerLog')
        await delay(200)
        // await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fromFixtures('test-project/src/completions.ts')))
        // await delay(800)
        console.time('ts-first-completion')
        await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', editor().document.uri, startPos)
        console.timeEnd('ts-first-completion')
    })

    it('Modifier & method snippets', async () => {
        const endPos = () => editor().document.lineAt(editor().document.lineCount - 1).range.end
        const pos = endPos()
        editor().selection = new vscode.Selection(endPos(), endPos())
        await vscode.commands.executeCommand('editor.action.triggerSuggest')
        // probably plugin reload
        await delay(300)
        const { items }: vscode.CompletionList = (await vscode.commands.executeCommand(
            'vscode.executeCompletionItemProvider',
            editor().document.uri,
            pos,
        )) as any
        expect(items.some(({ label }) => label === '☆sync')).to.equal(true)
        await vscode.commands.executeCommand('editor.action.triggerSuggest')
        await delay(500)
        await vscode.commands.executeCommand('acceptSelectedSuggestion')
        await delay(300)
        expect(editor().document.lineAt(endPos()).text).to.equal('a.sync(arg1)')
    })
})
