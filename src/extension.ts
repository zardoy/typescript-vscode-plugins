/* eslint-disable @typescript-eslint/no-require-imports */
import * as vscode from 'vscode'
import { defaultJsSupersetLangs } from '@zardoy/vscode-utils/build/langs'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { extensionCtx, getExtensionSettingId, getExtensionCommandId } from 'vscode-framework'
import { pickObj } from '@zardoy/utils'
import { TriggerCharacterCommand } from '../typescript/src/ipcTypes'
import { Configuration } from './configurationType'
import webImports from './webImports'
import { sendCommand } from './sendCommand'
import { registerEmmet } from './emmet'
import experimentalPostfixes from './experimentalPostfixes'
import migrateSettings from './migrateSettings'
import figIntegration from './figIntegration'

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

    tsApi.onCompletionAccepted((item: vscode.CompletionItem & { document: vscode.TextDocument }) => {
        const enableMethodSnippets = vscode.workspace.getConfiguration(process.env.IDS_PREFIX, item.document).get('enableMethodSnippets')
        const { documentation = '' } = item
        const documentationString = documentation instanceof vscode.MarkdownString ? documentation.value : documentation
        const insertFuncArgs = /<!-- insert-func: (.*)-->/.exec(documentationString)?.[1]
        console.debug('insertFuncArgs', insertFuncArgs)
        if (enableMethodSnippets && insertFuncArgs !== undefined) {
            const editor = getActiveRegularEditor()!
            const startPos = editor.selection.start
            const nextSymbol = editor.document.getText(new vscode.Range(startPos, startPos.translate(0, 1)))
            if (!['(', '.'].includes(nextSymbol)) {
                const snippet = new vscode.SnippetString('')
                snippet.appendText('(')
                const args = insertFuncArgs.split(',')
                for (let [i, arg] of args.entries()) {
                    if (!arg) continue
                    // skip empty, but add tabstops if we explicitly want it!
                    if (arg === ' ') arg = ''
                    snippet.appendPlaceholder(arg)
                    if (i !== args.length - 1) snippet.appendText(', ')
                }

                snippet.appendText(')')
                void editor.insertSnippet(snippet, undefined, {
                    undoStopAfter: false,
                    undoStopBefore: false,
                })
                if (vscode.workspace.getConfiguration('editor.parameterHints').get('enabled'))
                    void vscode.commands.executeCommand('editor.action.triggerParameterHints')
            }
        }
    })

    const sharedRequest = (type: TriggerCharacterCommand, { offset, relativeOffset = 0 }: RequestOptions) => {
        const { activeTextEditor } = vscode.window
        if (!activeTextEditor) return
        const { document, selection } = activeTextEditor
        offset ??= document.offsetAt(selection.active) + relativeOffset
        return sendCommand(type, { document, position: document.positionAt(offset) })
    }

    type RequestOptions = Partial<{
        offset: number
        relativeOffset: number
    }>
    vscode.commands.registerCommand(getExtensionCommandId('getNodeAtPosition' as never), async (options: RequestOptions = {}) =>
        sharedRequest('nodeAtPosition', options),
    )
    vscode.commands.registerCommand(getExtensionCommandId('getNodePath' as never), async (options: RequestOptions = {}) => sharedRequest('nodePath', options))

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

    experimentalPostfixes()
    void registerEmmet()
    webImports()

    figIntegration()
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
