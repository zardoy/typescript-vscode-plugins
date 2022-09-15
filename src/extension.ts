/* eslint-disable @typescript-eslint/no-require-imports */
import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { extensionCtx, getExtensionSettingId } from 'vscode-framework'
import { pickObj } from '@zardoy/utils'
import { Configuration } from './configurationType'

export const activate = async () => {
    const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features')
    if (!tsExtension) return

    await tsExtension.activate()

    if (!tsExtension.exports || !tsExtension.exports.getAPI) return

    // Get the API from the TS extension
    const api = tsExtension.exports.getAPI(0)
    if (!api) return

    const syncConfig = () => {
        console.log('sending configure request for typescript-essential-plugins')
        const config = vscode.workspace.getConfiguration().get(process.env.IDS_PREFIX!)
        // eslint-disable-next-line curly
        if (process.env.PLATFORM === 'node') {
            // see comment in plugin
            require('fs').writeFileSync(
                require('path').join(extensionCtx.extensionPath, './plugin-config.json'),
                JSON.stringify(pickObj(config as Configuration, 'patchOutline')),
            )
        }

        api.configurePlugin('typescript-essential-plugins', config)
    }

    vscode.workspace.onDidChangeConfiguration(async ({ affectsConfiguration }) => {
        if (affectsConfiguration(process.env.IDS_PREFIX!)) {
            syncConfig()
            if (affectsConfiguration(getExtensionSettingId('patchOutline'))) {
                await vscode.commands.executeCommand('typescript.restartTsServer')
                void vscode.window.showWarningMessage('outline will be updated after text changes')
            }
        }
    })
    syncConfig()

    api.onCompletionAccepted((item: vscode.CompletionItem & { document: vscode.TextDocument }) => {
        const enableMethodSnippets = vscode.workspace.getConfiguration(process.env.IDS_PREFIX, item.document).get('enableMethodSnippets')
        const { documentation = '' } = item
        const documentationString = documentation instanceof vscode.MarkdownString ? documentation.value : documentation
        const insertFuncArgs = /<!-- insert-func: (.*)-->/.exec(documentationString)?.[1]
        console.debug('insertFuncArgs', insertFuncArgs)
        if (enableMethodSnippets && insertFuncArgs !== undefined) {
            const editor = getActiveRegularEditor()!
            const startPos = editor.selection.start
            const nextSymbol = editor.document.getText(new vscode.Range(startPos, startPos.translate(0, 1)))
            if (!['(', '.'].includes(nextSymbol)) {
                const snippet = new vscode.SnippetString('')
                snippet.appendText('(')
                const args = insertFuncArgs.split(',')
                for (let [i, arg] of args.entries()) {
                    if (!arg) continue
                    // skip empty, but add tabstops if we explicitly want it!
                    if (arg === ' ') arg = ''
                    snippet.appendPlaceholder(arg)
                    if (i !== args.length - 1) snippet.appendText(', ')
                }

                snippet.appendText(')')
                void editor.insertSnippet(snippet, undefined, {
                    undoStopAfter: false,
                    undoStopBefore: false,
                })
                if (vscode.workspace.getConfiguration('editor.parameterHints').get('enabled'))
                    void vscode.commands.executeCommand('editor.action.triggerParameterHints')
            }
        }
    })
}
