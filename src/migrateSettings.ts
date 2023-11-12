import * as vscode from 'vscode'
import { migrateExtensionSettings } from '@zardoy/vscode-utils/build/migrateSettings'
import { Settings } from 'vscode-framework'

export default () => {
    void migrateExtensionSettings(
        [
            {
                rename: {
                    old: 'jsxEmmet',
                    new: 'jsxEmmet.enable',
                    mustBePrimitive: true,
                },
            },
            {
                rename: {
                    old: 'jsxPseudoEmmet',
                    new: 'jsxPseudoEmmet.enable',
                    mustBePrimitive: true,
                },
            },
            {
                rename: {
                    old: 'suggestions.banAutoImportPackages',
                    new: 'suggestions.ignoreAutoImports',
                    mustBePrimitive: false,
                },
            },
            {
                rename: {
                    old: 'removeOrMarkGlobalLibCompletions.action',
                    new: 'globalLibCompletions.action',
                    mustBePrimitive: false,
                },
            },
            {
                rename: {
                    old: 'methodSnippetsInsertText',
                    new: 'methodSnippets.previewSignature',
                    mustBePrimitive: false,
                },
            },
            {
                async detect(configuration) {
                    return !!(await migrateSettingValues(configuration, true))
                },
                async handle(configuration) {
                    return (await migrateSettingValues(configuration, false))!
                },
            },
        ],
        process.env.IDS_PREFIX!,
    )
}

async function migrateSettingValues(configuration: vscode.WorkspaceConfiguration, detectOnly: boolean) {
    const keepOriginalSettingKey: keyof Settings = 'objectLiteralCompletions.keepOriginal'
    const keepOriginal = configuration.get<string>(keepOriginalSettingKey)!
    const keepOriginalNewValuesMap = {
        below: 'before',
        above: 'after',
    }
    const newKeepOriginalValue = keepOriginalNewValuesMap[keepOriginal]
    if (newKeepOriginalValue) {
        if (!detectOnly) {
            await configuration.update(keepOriginalSettingKey, newKeepOriginalValue, vscode.ConfigurationTarget.Global)
        }

        return keepOriginalSettingKey
    }

    return undefined
}
