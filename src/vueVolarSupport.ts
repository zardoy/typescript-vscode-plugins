import * as vscode from 'vscode'
import { watchExtensionSettings } from '@zardoy/vscode-utils/build/settings'
import { extensionCtx, getExtensionSetting } from 'vscode-framework'

export default () => {
    if (process.env.PLATFORM !== 'node') return
    const handler = () => {
        const config = vscode.workspace.getConfiguration('')
        const VOLAR_CONFIG_FILE_SETTING = 'vue.server.configFilePath'
        if (!getExtensionSetting('enableVueSupport') || !vscode.extensions.getExtension('Vue.volar') || isConfigValueChanged(VOLAR_CONFIG_FILE_SETTING)) {
            return
        }

        void config.update(VOLAR_CONFIG_FILE_SETTING, extensionCtx.asAbsolutePath('./volarConfig.js'), vscode.ConfigurationTarget.Global)
    }

    handler()
    watchExtensionSettings(['enableVueSupport'], handler)
    vscode.extensions.onDidChange(handler)
}

const isConfigValueChanged = (settingId: string) => {
    if (process.env.PLATFORM !== 'web') {
        const config = vscode.workspace.getConfiguration('')
        const userValue = config.get<string>(settingId)
        if (userValue === config.inspect(settingId)!.defaultValue) return false
        // means that value was set by us programmatically, let's update it
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        if (userValue?.startsWith(require('path').join(extensionCtx.extensionPath, '../..'))) return false
        return true
    }

    return undefined
}
