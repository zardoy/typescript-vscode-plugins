import * as vscode from 'vscode'
import { watchExtensionSettings } from '@zardoy/vscode-utils/build/settings'
import { extensionCtx, getExtensionSetting } from 'vscode-framework'

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
}

const isConfigValueChanged = (id: string) => {
    const config = vscode.workspace.getConfiguration('')
    return config.get(id) !== config.inspect(id)!.defaultValue
}
