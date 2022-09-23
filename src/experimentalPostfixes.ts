import * as vscode from 'vscode'
import { defaultJsSupersetLangs } from '@zardoy/vscode-utils/build/langs'
import { getExtensionSetting } from 'vscode-framework'
import { PostfixCompletion } from '../typescript/src/ipcTypes'
import { sendCommand } from './sendCommand'

export default () => {
    vscode.languages.registerCompletionItemProvider(
        defaultJsSupersetLangs,
        {
            async provideCompletionItems(document, position, token, context) {
                if (!position.character) return
                if (!getExtensionSetting('experimentalPostfixes.enable')) return
                const beforeDotPos = document.getWordRangeAtPosition(position)?.start ?? position
                if (document.getText(new vscode.Range(beforeDotPos, beforeDotPos.translate(0, -1))) !== '.') return
                const postfixes = await sendCommand<PostfixCompletion[]>('getPostfixes', { document, position })
                const disablePostfixes = getExtensionSetting('experimentalPostfixes.disablePostfixes')
                return postfixes
                    ?.filter(({ label }) => !disablePostfixes.includes(label))
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
}
