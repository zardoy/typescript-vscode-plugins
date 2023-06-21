/* eslint-disable @typescript-eslint/no-require-imports */
import * as vscode from 'vscode'
import { defaultJsSupersetLangs } from '@zardoy/vscode-utils/build/langs'
import { Settings, extensionCtx, getExtensionSetting, getExtensionSettingId, registerExtensionCommand } from 'vscode-framework'
import { pickObj } from '@zardoy/utils'
import { watchExtensionSettings } from '@zardoy/vscode-utils/build/settings'
import { ConditionalPick } from 'type-fest'
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

let isActivated = false
// let erroredStatusBarItem: vscode.StatusBarItem | undefined

export const activateTsPlugin = (tsApi: { configurePlugin; onCompletionAccepted } | undefined) => {
    if (isActivated) return
    isActivated = true
    let webWaitingForConfigSync = false

    const syncConfig = () => {
        if (!tsApi) return
        console.log('sending configure request for typescript-essential-plugins')
        const config: any = { ...vscode.workspace.getConfiguration().get(process.env.IDS_PREFIX!) }
        // todo implement language-specific settings
        mergeSettingsFromScopes(config, 'typescript', extensionCtx.extension.packageJSON)

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
        if (affectsConfiguration(process.env.IDS_PREFIX!)) {
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
    codeActionProvider()

    figIntegration()
    vueVolarSupport()
}

export const activate = async () => {
    registerDisableOptionalFeaturesCommand()
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

const registerDisableOptionalFeaturesCommand = () => {
    registerExtensionCommand('disableAllOptionalFeatures', async () => {
        const config = vscode.workspace.getConfiguration(process.env.IDS_PREFIX, null)
        const toDisable: Array<[keyof Settings, any]> = []
        for (const optionalExperience of optionalExperiences) {
            const desiredKey = Array.isArray(optionalExperience) ? optionalExperience[0] : optionalExperience
            const desiredValue = Array.isArray(optionalExperience) ? optionalExperience[1] : false
            if (config.get(desiredKey) !== desiredValue) toDisable.push([desiredKey, desiredValue])
        }

        const action = await vscode.window.showInformationMessage(
            `${toDisable.length} features are going to be disabled`,
            { detail: '', modal: true },
            'Write to settings NOW',
            'Copy settings',
        )
        if (!action) return
        switch (action) {
            case 'Write to settings NOW': {
                for (const [key, value] of toDisable) {
                    void config.update(key, value, vscode.ConfigurationTarget.Global)
                }

                break
            }

            case 'Copy settings': {
                await vscode.env.clipboard.writeText(JSON.stringify(Object.fromEntries(toDisable), undefined, 4))
                break
            }
        }
    })
}

/** Experiences that are enabled out of the box */
const optionalExperiences: Array<keyof ConditionalPick<Settings, boolean> | [keyof Settings, any]> = [
    'enableMethodSnippets',
    'removeUselessFunctionProps.enable',
    'patchToString.enable',
    ['suggestions.keywordsInsertText', 'none'],
    'highlightNonFunctionMethods.enable',
    'markTsCodeActions.enable',
    ['markTsCodeFixes.character', ''],
    'removeCodeFixes.enable',
    'removeDefinitionFromReferences',
    'removeImportsFromReferences',
    'miscDefinitionImprovement',
    'improveJsxCompletions',
    'objectLiteralCompletions.moreVariants',
    'codeActions.extractTypeInferName',
]
