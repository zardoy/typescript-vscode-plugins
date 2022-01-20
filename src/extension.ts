import vsc from 'vscode'
import { registerActiveDevelopmentCommand } from 'vscode-framework'

export const activate = async () => {
    const tsExtension = vsc.extensions.getExtension('vscode.typescript-language-features')
    if (!tsExtension) return

    await tsExtension.activate()

    // Get the API from the TS extension
    if (!tsExtension.exports || !tsExtension.exports.getAPI) return

    const api = tsExtension.exports.getAPI(0)
    if (!api) return

    api.configurePlugin('my-typescript-plugin-id', {
        someValue: 'hey',
    })
}
