import * as vscode from 'vscode'
import { defaultLanguageSupersets } from '@zardoy/vscode-utils/build/langs'
import { getExtensionSetting } from 'vscode-framework'
import { sendCommand } from './sendCommand'

const jsxAttributesAutoTrigger = () => {
    vscode.workspace.onDidChangeTextDocument(async ({ contentChanges, document, reason }) => {
        const editor = vscode.window.activeTextEditor
        if (document !== editor?.document || contentChanges.length === 0) return
        if (contentChanges[0]!.text !== ' ') return
        if (![...defaultLanguageSupersets.react, 'javascript'].includes(document.languageId)) return
        if (!getExtensionSetting('completionsAutoTrigger.jsx')) return
        const path = await sendCommand('getNodePath', { document, position: editor.selection.active })
        if (!path) return
        if (['JsxSelfClosingElement', 'JsxOpeningElement'].includes(path.at(-1)?.kindName ?? '')) {
            await vscode.commands.executeCommand('editor.action.triggerSuggest')
        }
    })
}

export default () => {
    jsxAttributesAutoTrigger()
}
