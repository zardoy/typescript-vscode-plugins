import * as vscode from 'vscode'
import { watchExtensionSettings } from '@zardoy/vscode-utils/build/settings'
import { extensionCtx, getExtensionSetting } from 'vscode-framework'
import { join } from 'path-browserify'

export default () => {
    const handler = () => {
        const config = vscode.workspace.getConfiguration('')
        if (
            !getExtensionSetting('enableVueSupport') ||
            !vscode.extensions.getExtension('Vue.volar') ||
            isConfigValueChanged('volar.vueserver.configFilePath')
        ) {
            return
        }

        void config.update('volar.vueserver.configFilePath', extensionCtx.asAbsolutePath('./volarConfig.js'), vscode.ConfigurationTarget.Global)
    }

    handler()
    watchExtensionSettings(['enableVueSupport'], handler)
    vscode.extensions.onDidChange(handler)
}

const isConfigValueChanged = (id: string) => {
    const config = vscode.workspace.getConfiguration('')
    const userValue = config.get<string>(id)
    if (userValue === config.inspect(id)!.defaultValue) return false
    // means that value was set by us programmatically, let's update it
    if (userValue?.startsWith(join(extensionCtx.extensionPath, '..'))) return false
    return true
}
