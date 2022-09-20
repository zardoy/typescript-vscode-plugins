/* eslint-disable @typescript-eslint/no-require-imports */
import * as vscode from 'vscode'
import { defaultJsSupersetLangs } from '@zardoy/vscode-utils/build/langs'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { getExtensionSetting, extensionCtx, getExtensionSettingId, getExtensionCommandId, registerActiveDevelopmentCommand } from 'vscode-framework'
import { pickObj } from '@zardoy/utils'
import { PostfixCompletion, TriggerCharacterCommand } from '../typescript/src/ipcTypes'
import { Configuration } from './configurationType'
import webImports from './webImports'

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

    type SendCommandData = {
        position: vscode.Position
        document: vscode.TextDocument
    }
    const sendCommand = async (command: TriggerCharacterCommand, sendCommandDataArg: SendCommandData) => {
        const { document, position } = ((): SendCommandData => {
            if (sendCommandDataArg) return sendCommandDataArg
            const editor = getActiveRegularEditor()!
            return {
                document: editor.document,
                position: editor.selection.active,
            }
        })()
        console.time(`request ${command}`)
        let requestFile = document.uri.fsPath
        // TODO fix for all schemes
        if (document.uri.scheme === 'untitled') requestFile = `^/untitled/ts-nul-authority/${document.uri.path}`
        try {
            const result = (await vscode.commands.executeCommand('typescript.tsserverRequest', 'completionInfo', {
                _: '%%%',
                file: requestFile,
                line: position.line + 1,
                offset: position.character,
                triggerCharacter: command,
            })) as any
            if (!result || !result.body) return
            return result.body
        } catch (err) {
            console.error(err)
        } finally {
            console.timeEnd(`request ${command}`)
        }
    }

    vscode.languages.registerCompletionItemProvider(
        defaultJsSupersetLangs,
        {
            async provideCompletionItems(document, position, token, context) {
                if (!position.character) return
                if (!getExtensionSetting('experimentalPostfixes.enable')) return
                const beforeDotPos = document.getWordRangeAtPosition(position)?.start ?? position
                if (document.getText(new vscode.Range(beforeDotPos, beforeDotPos.translate(0, -1))) !== '.') return
                const result = await sendCommand('getPostfixes', { document, position })
                const disablePostfixes = getExtensionSetting('experimentalPostfixes.disablePostfixes')
                // eslint-disable-next-line prefer-destructuring
                const typescriptEssentialsResponse: PostfixCompletion[] = result.typescriptEssentialsResponse
                if (!typescriptEssentialsResponse) return
                return typescriptEssentialsResponse
                    .filter(({ label }) => !disablePostfixes.includes(label))
                    .map(
                        ({ label, insertText }): vscode.CompletionItem => ({
                            label,
                            insertText,
                            sortText: '07',
                            range: new vscode.Range(beforeDotPos.translate(0, -1), position),
                            filterText: document.getText(new vscode.Range(beforeDotPos.translate(0, -1), position)) + label,
                            kind: vscode.CompletionItemKind.Event,
                            // additionalTextEdits: [
                            //     vscode.TextEdit.replace(
                            //         new vscode.Range(document.positionAt(replacement[0]), replacement[1] ? document.positionAt(replacement[1]) : position),
                            //         insertText,
                            //     ),
                            // ],
                        }),
                    )
            },
        },
        '.',
    )

    type RequestOptions = Partial<{
        offset: number
    }>
    vscode.commands.registerCommand(getExtensionCommandId('getNodeAtPosition' as never), async (_, { offset }: RequestOptions = {}) => {
        const { activeTextEditor } = vscode.window
        if (!activeTextEditor) return
        const { document } = activeTextEditor
        const { typescriptEssentialsResponse: data } =
            (await sendCommand('nodeAtPosition', { document, position: offset ? document.positionAt(offset) : activeTextEditor.selection.active })) ?? {}
        return data
    })

    if (process.env.PLATFORM === 'web') {
        const possiblySyncConfig = async () => {
            const { activeTextEditor } = vscode.window
            if (!activeTextEditor || !vscode.languages.match(defaultJsSupersetLangs, activeTextEditor.document)) return
            if (!webWaitingForConfigSync) return
            // webWaitingForConfigSync = false
            const config = vscode.workspace.getConfiguration().get(process.env.IDS_PREFIX!)
            void sendCommand(`updateConfig${JSON.stringify(config)}` as any, undefined!)
        }

        vscode.window.onDidChangeActiveTextEditor(possiblySyncConfig)
        void possiblySyncConfig()
    }

    webImports()

    // registerActiveDevelopmentCommand(async () => {
    //     const items: vscode.DocumentSymbol[] = await vscode.commands.executeCommand(
    //         'vscode.executeDocumentSymbolProvider',
    //         vscode.Uri.file(...),
    //     )
    // })
}

export const activate = async () => {
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
