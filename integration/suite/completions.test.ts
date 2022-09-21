import * as vscode from 'vscode'
import delay from 'delay'

import { expect } from 'chai'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
import { fromFixtures, prepareTsStart } from './utils'

describe.skip('Completions', () => {
    const editor = () => vscode.window.activeTextEditor!

    before(async function () {
        this.timeout(6000)
        // await vscode.workspace.getConfiguration('typescript').update('tsserver.log', 'verbose', vscode.ConfigurationTarget.Global)
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fromFixtures('test-project/src/completions.ts')))
        await prepareTsStart()
        // await vscode.commands.executeCommand('typescript.openTsServerLog')
    })

    it('Modifier & method snippets', async () => {
        const endPos = () => editor().document.lineAt(editor().document.lineCount - 1).range.end
        const pos = endPos()
        editor().selection = new vscode.Selection(endPos(), endPos())
        await delay(1000)
        await vscode.commands.executeCommand('editor.action.triggerSuggest')
        const { items }: vscode.CompletionList = (await vscode.commands.executeCommand(
            'vscode.executeCompletionItemProvider',
            editor().document.uri,
            pos,
        )) as any
        expect(items.some(({ label }) => label === '☆sync')).to.equal(true)
        await delay(200)
        await vscode.commands.executeCommand('acceptSelectedSuggestion')
        await delay(300)
        expect(editor().document.lineAt(endPos()).text).to.equal('a.sync(arg1)')
    }).timeout(5000)

    after(async () => {
        await vscode.commands.executeCommand('workbench.action.files.revert')
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
    })
})
