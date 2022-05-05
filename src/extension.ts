import * as vscode from 'vscode'
import { getExtensionId, registerActiveDevelopmentCommand } from 'vscode-framework'

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
        api.configurePlugin('my-typescript-plugin-id', config)
    }
    vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
        if (affectsConfiguration(getExtensionId())) syncConfig()
    })
    syncConfig()
}
