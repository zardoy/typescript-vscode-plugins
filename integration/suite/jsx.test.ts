import * as vscode from 'vscode'
import delay from 'delay'

import { expect } from 'chai'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
import { fromFixtures, prepareTsStart, replaceEditorText } from './utils'
//@ts-ignore
import { Configuration } from '../../src/configurationType'

describe('JSX Attributes', () => {
    const editor = () => vscode.window.activeTextEditor!

    const startPos = new vscode.Position(0, 0)
    before(async function () {
        this.timeout(5000)
        // await vscode.workspace.getConfiguration('typescript').update('tsserver.log', 'verbose', vscode.ConfigurationTarget.Global)
        const configKey: keyof Configuration = 'jsxCompletionsMap'
        const configValue: Configuration['jsxCompletionsMap'] = {
            'div#classNam*': { insertText: '={test$1}' },
        }
        await vscode.workspace.getConfiguration('tsEssentialPlugins').update(configKey, configValue, vscode.ConfigurationTarget.Global)
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fromFixtures('test-project/src/index.tsx')))
        await prepareTsStart()
    })

    it('JSX attribute patch', async () => {
        const searchText = /* className */ '="main__wrap"'
        const pos = editor().document.positionAt(editor().document.getText().indexOf(searchText))
        const endPos = pos.translate(0, searchText.length)
        await replaceEditorText(editor(), new vscode.Range(pos, endPos), '')
        editor().selection = new vscode.Selection(pos, pos)
        // vscode has slow startup in react langs
        await delay(1300)
        await vscode.commands.executeCommand('editor.action.triggerSuggest')
        await delay(500)
        await vscode.commands.executeCommand('acceptSelectedSuggestion')
        await delay(300)
        expect(editor().document.lineAt(pos).text.slice(pos.character)).to.equal('={test}>')
    }).timeout(5000)

    after(async () => {
        await vscode.commands.executeCommand('workbench.action.files.revert')
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
    })
})
