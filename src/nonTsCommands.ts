import * as vscode from 'vscode'
import { ConditionalPick } from 'type-fest'
import { registerExtensionCommand, Settings } from 'vscode-framework'
import { getCurrentWorkspaceRoot } from '@zardoy/vscode-utils/build/fs'
import { Utils } from 'vscode-uri'
import { showQuickPick } from '@zardoy/vscode-utils/build/quickPick'

// these commands doesn't require TS to be available

export default () => {
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

    registerExtensionCommand('replaceGlobalTypescriptWithLocalVersion', async () => {
        const root = getCurrentWorkspaceRoot()
        const localTypeScript = Utils.joinPath(root.uri, 'node_modules/typescript')
        const globalTypeScript = Utils.joinPath(vscode.Uri.file(vscode.env.appRoot), 'extensions/node_modules/typescript')
        const { version: localVersion } = await vscode.workspace.fs
            .readFile(Utils.joinPath(localTypeScript, 'package.json'))
            .then(result => JSON.parse(result.toString()))
        const { version: globalVersion } = await vscode.workspace.fs
            .readFile(Utils.joinPath(globalTypeScript, 'package.json'))
            .then(result => JSON.parse(result.toString()))
        const result = await showQuickPick([`Replace global TS ${globalVersion} with local ${localVersion}`].map(x => ({ value: x, label: x })))
        if (!result) return
        const paths = ['package.json', 'lib']
        for (const path of paths) {
            // eslint-disable-next-line no-await-in-loop
            await vscode.workspace.fs.copy(Utils.joinPath(localTypeScript, path), Utils.joinPath(globalTypeScript, path), { overwrite: true })
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
