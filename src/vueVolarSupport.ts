import * as vscode from 'vscode'
import { watchExtensionSettings } from '@zardoy/vscode-utils/build/settings'
import { extensionCtx, getExtensionCommandId, getExtensionSetting } from 'vscode-framework'
import { gte } from 'semver'

let languageStatusItem: vscode.LanguageStatusItem | undefined

const updateVolarConfigCommandId = getExtensionCommandId('updateVolarConfig' as any)
const VOLAR_CONFIG_FILE_SETTING = 'vue.server.configFilePath'
const MINIMUM_VOLAR_VERSION = '1.7.0'

export default () => {
    if (process.env.PLATFORM !== 'node') return

    const handler = async () => {
        languageStatusItem?.dispose()

        const volar = vscode.extensions.getExtension('Vue.volar')
        if (!getExtensionSetting('enableVueSupport') || !volar) {
            return
        }

        if (!gte(volar.packageJSON.version, MINIMUM_VOLAR_VERSION)) {
            languageStatusItem = vscode.languages.createLanguageStatusItem('typescriptEssentialPluginsWrongVue', { language: 'vue' })
            languageStatusItem.text = 'Volar version is too old.'
            languageStatusItem.severity = vscode.LanguageStatusSeverity.Error
            languageStatusItem.detail = `Update Volar to ${MINIMUM_VOLAR_VERSION} or higher.`
            return
        }

        let restartNeeded = false
        if (isConfigValueChanged(VOLAR_CONFIG_FILE_SETTING)) {
            if (process.env.NODE_ENV === 'production') {
                languageStatusItem = vscode.languages.createLanguageStatusItem('typescriptEssentialPluginsWrongVue', { language: 'vue' })
                languageStatusItem.text = 'Using custom volar config instead of plugins one.'
                languageStatusItem.severity = vscode.LanguageStatusSeverity.Warning
                languageStatusItem.detail = 'Either disable Volar support or click to update "vue.server.configFilePath".'
                languageStatusItem.command = {
                    title: 'Update "vue.server.configFilePath" & restart.',
                    command: updateVolarConfigCommandId,
                    arguments: [true],
                }
                return
            }

            const choice = await vscode.window.showWarningMessage(
                'Probably using production volar config instead of development one.',
                'Update global setting & restart',
            )
            if (!choice) return
            restartNeeded = true
        }

        await vscode.commands.executeCommand(updateVolarConfigCommandId, restartNeeded)
    }

    void handler()
    watchExtensionSettings(['enableVueSupport'], handler)
    vscode.extensions.onDidChange(handler)

    vscode.commands.registerCommand(updateVolarConfigCommandId, async restartNeeded => {
        await vscode.workspace
            .getConfiguration('')
            .update(VOLAR_CONFIG_FILE_SETTING, extensionCtx.asAbsolutePath('./volarConfig.js'), vscode.ConfigurationTarget.Global)
        if (restartNeeded) {
            void vscode.commands.executeCommand('volar.action.restartServer')
        }
    })
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
