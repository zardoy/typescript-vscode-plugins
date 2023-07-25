/* eslint-disable @typescript-eslint/no-require-imports */
import * as vscode from 'vscode'
import { defaultJsSupersetLangs } from '@zardoy/vscode-utils/build/langs'
import { extensionCtx, getExtensionSetting, getExtensionSettingId } from 'vscode-framework'
import { pickObj } from '@zardoy/utils'
import { watchExtensionSettings } from '@zardoy/vscode-utils/build/settings'
import webImports from './webImports'
import { sendCommand } from './sendCommand'
import { registerEmmet } from './emmet'
import migrateSettings from './migrateSettings'
import figIntegration from './figIntegration'
import apiCommands from './apiCommands'
import onCompletionAccepted from './onCompletionAccepted'
import specialCommands from './specialCommands'
import vueVolarSupport from './vueVolarSupport'
import moreCompletions from './moreCompletions'
import { mergeSettingsFromScopes } from './mergeSettings'
import codeActionProvider from './codeActionProvider'
import nonTsCommands from './nonTsCommands'

let isActivated = false
// let erroredStatusBarItem: vscode.StatusBarItem | undefined

export const activateTsPlugin = (tsApi: { configurePlugin; onCompletionAccepted } | undefined) => {
    if (isActivated) return
    isActivated = true
    let webWaitingForConfigSync = false

    const getResolvedConfig = () => {
        const configuration = vscode.workspace.getConfiguration()
        const config: any = {
            ...configuration.get(process.env.IDS_PREFIX!),
            editorSuggestInsertModeReplace: configuration.get('editor.suggest.insertMode') === 'replace',
        }
        mergeSettingsFromScopes(config, 'typescript', extensionCtx.extension.packageJSON)
        return config
    }

    const syncConfig = () => {
        if (!tsApi) return
        console.log('sending configure request for typescript-essential-plugins')
        // todo implement language-specific settings
        const config = getResolvedConfig()
        tsApi.configurePlugin('typescript-essential-plugins', config)

        if (process.env.PLATFORM === 'node') {
            // see comment in plugin
            require('fs').writeFileSync(
                require('path').join(extensionCtx.extensionPath, './plugin-config.json'),
                JSON.stringify(pickObj(config, 'patchOutline', 'outline')),
            )
        }

        if (process.env.PLATFORM === 'web') {
            webWaitingForConfigSync = true
        }
    }

    vscode.workspace.onDidChangeConfiguration(async ({ affectsConfiguration }) => {
        if (affectsConfiguration(process.env.IDS_PREFIX!) || affectsConfiguration('editor.suggest.insertMode')) {
            syncConfig()
            if (
                process.env.PLATFORM === 'node' &&
                (affectsConfiguration(getExtensionSettingId('patchOutline')) ||
                    affectsConfiguration(getExtensionSettingId('outline.arraysTuplesNumberedItems')))
            ) {
                await vscode.commands.executeCommand('typescript.restartTsServer')
                void vscode.window.showWarningMessage('Outline will be updated after text changes or window reload')
            }
        }
    })
    syncConfig()

    if (tsApi) onCompletionAccepted(tsApi)

    if (process.env.PLATFORM === 'web') {
        const possiblySyncConfig = async () => {
            const { activeTextEditor } = vscode.window
            if (!activeTextEditor || !vscode.languages.match(defaultJsSupersetLangs, activeTextEditor.document)) return
            if (!webWaitingForConfigSync) return
            // webWaitingForConfigSync = false
            const config = getResolvedConfig()
            void sendCommand(`updateConfig${JSON.stringify(config)}` as any, { inputOptions: {} })
        }

        vscode.window.onDidChangeActiveTextEditor(possiblySyncConfig)
        void possiblySyncConfig()
    }

    moreCompletions()
    void registerEmmet()
    webImports()
    apiCommands()
    specialCommands()
    codeActionProvider()

    figIntegration()
    vueVolarSupport()
}

export const activate = async () => {
    nonTsCommands()
    migrateSettings()

    const possiblyActivateTsPlugin = async () => {
        const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features')
        if (tsExtension) {
            await tsExtension.activate()

            if (!tsExtension.exports || !tsExtension.exports.getAPI) {
                throw new Error("TS extension doesn't export API")
            }

            // Get the API from the TS extension
            const api = tsExtension.exports.getAPI(0)
            if (!api) {
                throw new Error("TS extension doesn't have API")
            }

            activateTsPlugin(api)
            return true
        }

        if (vscode.extensions.getExtension('Vue.volar') && getExtensionSetting('enableVueSupport')) {
            activateTsPlugin(undefined)
            return true
        }

        return false
    }

    const isActivated = (await possiblyActivateTsPlugin()) ?? false
    if (!isActivated) {
        // can be also used in future, for now only when activating TS or Volar extension manually
        const disposables = []
        const { dispose } = vscode.extensions.onDidChange(
            async () => {
                if (await possiblyActivateTsPlugin()) dispose()
            },
            undefined,
            disposables,
        )
        watchExtensionSettings(['enableVueSupport'], async () => {
            if (await possiblyActivateTsPlugin()) {
                // todo
                // disposables.forEach(d => d.dispose())
            }
        })
    }
}
