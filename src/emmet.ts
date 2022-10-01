import * as vscode from 'vscode'
import { getExtensionSetting, registerExtensionCommand } from 'vscode-framework'
import { EmmetResult } from '../typescript/src/ipcTypes'
import { sendCommand } from './sendCommand'

export const registerEmmet = async () => {
    if (process.env.PLATFORM !== 'web') {
        let isEmmetEnabled: boolean
        const setIsEmmetEnabled = () => {
            isEmmetEnabled = !!vscode.extensions.getExtension('vscode.emmet')
        }

        setIsEmmetEnabled()
        vscode.extensions.onDidChange(setIsEmmetEnabled)

        const emmet = await import('@vscode/emmet-helper')
        const reactLangs = ['javascriptreact', 'typescriptreact']
        vscode.languages.registerCompletionItemProvider(
            reactLangs,
            {
                async provideCompletionItems(document, position, token, context) {
                    if (!getExtensionSetting('jsxEmmet')) return
                    const emmetConfig = vscode.workspace.getConfiguration('emmet')
                    if (isEmmetEnabled && !emmetConfig.excludeLanguages.includes(document.languageId)) return

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
                    return {
                        items:
                            improveEmmetCompletions<any>(normalizedCompletions)?.map(({ label, insertText, rangeLength, documentation, sortText }) => ({
                                label: { label, description: 'EMMET' },
                                // sortText is overrided if its a number
                                sortText: Number.isNaN(+sortText) ? '075' : sortText,
                                insertText: new vscode.SnippetString(insertText),
                                range: new vscode.Range(position.translate(0, -rangeLength), position),
                                documentation: documentation as string,
                            })) ?? [],
                        isIncomplete: true,
                    }
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
                await vscode.workspace
                    .getConfiguration('emmet')
                    .update('excludeLanguages', [...emmetExcludedLangs, ...addExcludeLangs], vscode.ConfigurationTarget.Global)
                void vscode.window.showInformationMessage(`Added to ${addExcludeLangs.join(',')} emmet.excludeLanguages`)
            }

            await vscode.workspace.getConfiguration(process.env.IDS_PREFIX).update('jsxEmmet', true, vscode.ConfigurationTarget.Global)
            await vscode.workspace.getConfiguration(process.env.IDS_PREFIX).update('jsxPseudoEmmet', false, vscode.ConfigurationTarget.Global)
        })

        // TODO: select wrap, matching, rename tag
    }
}

function getEmmetConfiguration() {
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

const improveEmmetCompletions = <T extends Record<'label' | 'insertText' | 'sortText', string>>(items: T[] | undefined) => {
    if (!items) return
    // TODO-low make to tw= by default when twin.macro is installed?
    const dotSnippetOverride = getExtensionSetting('jsxEmmet.dotOverride')
    const modernEmmet = getExtensionSetting('jsxEmmet.modernize')

    return items.map(item => {
        const { label } = item
        if (label === '.' && typeof dotSnippetOverride === 'string') item.insertText = dotSnippetOverride
        // change sorting to most used
        if (['div', 'b'].includes(label)) item.sortText = '070'
        if (label.startsWith('btn')) item.sortText = '073'
        if (modernEmmet) {
            // remove id from input suggestions
            if (label === 'inp' || label.startsWith('input:password')) {
                item.insertText = item.insertText.replace(/ id="\${\d}"/, '')
            }

            if (label === 'textarea') item.insertText = `<textarea>$1</textarea>`
        }

        return item
    })
}
