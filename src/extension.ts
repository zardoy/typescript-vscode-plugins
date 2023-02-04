/* eslint-disable @typescript-eslint/no-require-imports */
import * as vscode from 'vscode'
import { defaultJsSupersetLangs } from '@zardoy/vscode-utils/build/langs'
import { extensionCtx, getExtensionSettingId } from 'vscode-framework'
import { pickObj } from '@zardoy/utils'
import { Configuration } from './configurationType'
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

export const activateTsPlugin = (tsApi: { configurePlugin; onCompletionAccepted }) => {
    let webWaitingForConfigSync = false

    const syncConfig = () => {
        console.log('sending configure request for typescript-essential-plugins')
        const config = vscode.workspace.getConfiguration().get(process.env.IDS_PREFIX!)

        if (process.env.PLATFORM === 'node') {
            // see comment in plugin
            require('fs').writeFileSync(
                require('path').join(extensionCtx.extensionPath, './plugin-config.json'),
                JSON.stringify(pickObj(config as Configuration, 'patchOutline')),
            )
        }

        tsApi.configurePlugin('typescript-essential-plugins', config)

        if (process.env.PLATFORM === 'web') {
            webWaitingForConfigSync = true
        }
    }

    vscode.workspace.onDidChangeConfiguration(async ({ affectsConfiguration }) => {
        if (affectsConfiguration(process.env.IDS_PREFIX!)) {
            syncConfig()
            if (process.env.PLATFORM === 'node' && affectsConfiguration(getExtensionSettingId('patchOutline'))) {
                await vscode.commands.executeCommand('typescript.restartTsServer')
                void vscode.window.showWarningMessage('Outline will be updated after text changes or window reload')
            }
        }
    })
    syncConfig()

    onCompletionAccepted(tsApi)

    if (process.env.PLATFORM === 'web') {
        const possiblySyncConfig = async () => {
            const { activeTextEditor } = vscode.window
            if (!activeTextEditor || !vscode.languages.match(defaultJsSupersetLangs, activeTextEditor.document)) return
            if (!webWaitingForConfigSync) return
            // webWaitingForConfigSync = false
            const config = vscode.workspace.getConfiguration().get(process.env.IDS_PREFIX!)
            void sendCommand(`updateConfig${JSON.stringify(config)}` as any)
        }

        vscode.window.onDidChangeActiveTextEditor(possiblySyncConfig)
        void possiblySyncConfig()
    }

    moreCompletions()
    void registerEmmet()
    webImports()
    apiCommands()
    specialCommands()

    figIntegration()
    vueVolarSupport()
}

export const activate = async () => {
    migrateSettings()

    const possiblyActivateTsPlugin = async () => {
        const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features')
        if (!tsExtension) return

        await tsExtension.activate()

        if (!tsExtension.exports || !tsExtension.exports.getAPI) return

        // Get the API from the TS extension
        const api = tsExtension.exports.getAPI(0)
        if (!api) return
        activateTsPlugin(api)
        return true
    }

    const isActivated = (await possiblyActivateTsPlugin()) ?? false
    if (!isActivated) {
        // can be also used in future, for now only when activating TS extension manually
        const { dispose } = vscode.extensions.onDidChange(async () => {
            if (await possiblyActivateTsPlugin()) dispose()
        })
    }
}
