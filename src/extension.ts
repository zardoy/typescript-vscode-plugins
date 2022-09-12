import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import {} from 'vscode-framework'

export const activate = async () => {
    const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features')
    if (!tsExtension) return

    await tsExtension.activate()

    // Get the API from the TS extension
    if (!tsExtension.exports || !tsExtension.exports.getAPI) return

    const api = tsExtension.exports.getAPI(0)
    if (!api) return

    const syncConfig = () => {
        const config = vscode.workspace.getConfiguration().get(process.env.IDS_PREFIX!)
        api.configurePlugin('typescript-essential-plugins', config)
    }

    vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
        if (affectsConfiguration(process.env.IDS_PREFIX!)) syncConfig()
    })
    syncConfig()

    api.onCompletionAccepted((item: vscode.CompletionItem & { document: vscode.TextDocument }) => {
        const enableMethodSnippets = vscode.workspace.getConfiguration(process.env.IDS_PREFIX, item.document).get('enableMethodSnippets')
        const { documentation = '' } = item
        const documentationString = documentation instanceof vscode.MarkdownString ? documentation.value : documentation
        const insertFuncArgs = /<!-- insert-func: (.*)-->/.exec(documentationString)?.[1]
        if (enableMethodSnippets && insertFuncArgs !== undefined) {
            const editor = getActiveRegularEditor()!
            const startPos = editor.selection.start
            const nextSymbol = editor.document.getText(new vscode.Range(startPos, startPos.translate(0, 1)))
            if (nextSymbol !== '(') {
                const snippet = new vscode.SnippetString('')
                snippet.appendText('(')
                const args = insertFuncArgs.split(',')
                for (const [i, arg] of args.entries()) {
                    if (!arg) continue
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
