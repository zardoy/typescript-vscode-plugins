import * as vscode from 'vscode'
import { defaultJsSupersetLangs } from '@zardoy/vscode-utils/build/langs'
import { getExtensionSetting } from 'vscode-framework'

export default async () => {
    // todo I think would be good to support zx package $
    const figExtension = vscode.extensions.getExtension('undefined_publisher.fig-unreleased')
    if (!figExtension) return
    const api = await figExtension.activate()

    api.registerLanguageSupport(
        // why include react langs? becuase of ink package!
        defaultJsSupersetLangs,
        {
            async provideSingleLineRangeFromPosition(doc: vscode.TextDocument, position: vscode.Position) {
                const enableWhenStartsWith = getExtensionSetting('figIntegration.enableWhenStartsWith')
                if (enableWhenStartsWith.length === 0) return

                const path: any[] = await vscode.commands.executeCommand('tsEssentialPlugins.getNodePath', {
                    offset: doc.offsetAt(position.translate(0, -1)),
                })
                if (!path) return
                const lastTwoPaths = path.slice(-2)
                const kinds = lastTwoPaths.map(({ kindName }) => kindName)
                if (kinds[0] !== 'CallExpression' || !['StringLiteral', 'FirstTemplateToken'].includes(kinds[1])) return
                // todo use info from ts server isntead
                const callExpr = lastTwoPaths[0]
                const stringNode = lastTwoPaths[1]
                const callExpressionText = doc.getText(new vscode.Range(doc.positionAt(callExpr.start), doc.positionAt(callExpr.end)))
                if (enableWhenStartsWith.every(str => !callExpressionText.startsWith(str))) return
                return new vscode.Range(doc.positionAt((stringNode.start as number) + 1), doc.positionAt(stringNode.end - 1))
            },
        },
        {
            // don't collide with TS rename provider
            disableProviders: ['rename'],
            enableCompletionProvider: {
                processCompletions(completions) {
                    // make it above vscode snippets, maybe should make it builtin?
                    return completions.map(({ sortText = '', ...compl }) => ({ ...compl, sortText: `!${sortText}` }))
                },
            },
        },
    )
}
