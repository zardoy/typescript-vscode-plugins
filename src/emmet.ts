import * as vscode from 'vscode'
import { registerExtensionCommand, updateExtensionSetting } from 'vscode-framework'
import { EmmetResult } from '../typescript/src/ipcTypes'
import { sendCommand } from './sendCommand'

export const registerEmmet = async () => {
    if (process.env.PLATFORM !== 'web') {
        const emmet = await import('@vscode/emmet-helper')
        const reactLangs = ['javascriptreact', 'typescriptreact']
        vscode.languages.registerCompletionItemProvider(
            reactLangs,
            {
                async provideCompletionItems(document, position, token, context) {
                    const emmetConfig = vscode.workspace.getConfiguration('emmet')
                    if (!emmetConfig.excludeLanguages.includes(document.languageId)) return

                    const result = await sendCommand<EmmetResult>('emmet-completions', { document, position })
                    if (!result) return
                    const offset = document.offsetAt(position)
                    const sendToEmmet = document.getText().slice(offset + result.emmetTextOffset, offset)
                    const emmetCompletions = emmet.doComplete(
                        {
                            getText: () => sendToEmmet,
                            languageId: 'typescriptreact',
                            lineCount: 1,
                            offsetAt: position => position.character,
                            positionAt: offset => ({ line: 0, character: offset }),
                            uri: '/',
                            version: 1,
                        },
                        { line: 0, character: sendToEmmet.length },
                        'jsx',
                        getEmmetConfiguration(),
                    ) ?? { items: undefined }
                    const normalizedCompletions = (emmetCompletions?.items ?? []).map(({ label, insertTextFormat, textEdit, documentation }) => {
                        const { newText, range } = textEdit as any
                        return {
                            label,
                            insertText: newText,
                            documentation,
                            rangeLength: sendToEmmet.length - range.start.character,
                        }
                    })
                    return normalizedCompletions?.map(({ label, insertText, rangeLength, documentation }) => ({
                        label: { label, description: 'EMMET' },
                        sortText: '07',
                        insertText: new vscode.SnippetString(insertText),
                        range: new vscode.Range(position.translate(0, -rangeLength), position),
                        documentation: documentation as string,
                    }))
                },
            },
            // eslint-disable-next-line unicorn/no-useless-spread
            ...['!', '.', '}', '*', '$', ']', '/', '>', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
        )

        registerExtensionCommand('enableStrictEmmetInJsx', async () => {
            const emmetConfig = vscode.workspace.getConfiguration('emmet')
            const emmetExcludedLangs: string[] = emmetConfig.excludeLanguages ?? []
            const addExcludeLangs = reactLangs.filter(lang => !emmetExcludedLangs.includes(lang))
            if (addExcludeLangs.length > 0) {
                await vscode.workspace.getConfiguration('emmet').update('excludeLanguages', [...emmetExcludedLangs, ...addExcludeLangs])
                void vscode.window.showInformationMessage(`Added to ${addExcludeLangs.join(',')} emmet.excludeLanguages`)
            }

            await updateExtensionSetting('jsxEmmet', true)
            await updateExtensionSetting('jsxPseudoEmmet', false)
        })

        // TODO: select wrap, matching, rename tag
    }
}

export function getEmmetConfiguration() {
    const syntax = 'jsx'
    // TODO lang-overrides?
    const emmetConfig = vscode.workspace.getConfiguration('emmet')
    const syntaxProfiles = { ...emmetConfig.syntaxProfiles }
    const preferences = { ...emmetConfig.preferences }
    // jsx, xml and xsl syntaxes need to have self closing tags unless otherwise configured by user
    if (['jsx', 'xml', 'xsl'].includes(syntax)) {
        syntaxProfiles[syntax] = syntaxProfiles[syntax] || {}
        if (typeof syntaxProfiles[syntax] === 'object' && !syntaxProfiles[syntax].selfClosingStyle) {
            syntaxProfiles[syntax] = {
                ...syntaxProfiles[syntax],
                selfClosingStyle: syntax === 'jsx' ? 'xhtml' : 'xml',
            }
        }
    }

    return {
        preferences,
        showExpandedAbbreviation: emmetConfig.showExpandedAbbreviation,
        showAbbreviationSuggestions: emmetConfig.showAbbreviationSuggestions,
        syntaxProfiles,
        variables: emmetConfig.variables,
        excludeLanguages: [],
        showSuggestionsAsSnippets: emmetConfig.showSuggestionsAsSnippets,
    }
}
