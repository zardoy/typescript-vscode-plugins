import * as vscode from 'vscode'

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
    setTimeout(() => syncConfig(), 500)
    setTimeout(() => syncConfig(), 1500)
}
