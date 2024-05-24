import * as vscode from 'vscode'
import { watchExtensionSetting } from '@zardoy/vscode-utils/build/settings'
import { getExtensionSetting, registerActiveDevelopmentCommand } from 'vscode-framework'

// todo respect enabled setting, deactivate
export default () => {
    const provider = new (class implements vscode.InlayHintsProvider {
        eventEmitter = new vscode.EventEmitter<void>()
        onDidChangeInlayHints = this.eventEmitter.event
        provideInlayHints(document: vscode.TextDocument, range: vscode.Range, token: vscode.CancellationToken): vscode.ProviderResult<vscode.InlayHint[]> {
            const diagnostics = vscode.languages.getDiagnostics(document.uri)
            const jsxMissingAttributesErrors = diagnostics.filter(({ code, source }) => (code === 2740 || code === 2739) && source === 'ts')
            return jsxMissingAttributesErrors
                .flatMap(({ range, message }) => {
                    const regex = /: (?<prop>[\w, ]+)(?:, and (?<more>\d+) more)?\.?$/
                    const match = regex.exec(message)
                    if (!match) return null as never
                    const props = match.groups!.prop!.split(', ')
                    const { more } = match.groups!
                    let text = ` ${props.map(prop => `${prop}!`).join(', ')}`
                    if (more) text += `, and ${more} more`
                    return {
                        kind: vscode.InlayHintKind.Type,
                        label: text,
                        tooltip: `Inlay hint: Missing attributes`,
                        position: range.end,
                        paddingLeft: true,
                    } satisfies vscode.InlayHint
                    // return [...props, ...(more ? [more] : [])].map((prop) => ({
                    //     kind: vscode.InlayHintKind.Type,
                    //     label: prop,
                    //     tooltip: 'Missing attribute',
                    //     position:
                    // }))
                })
                .filter(Boolean)
        }
    })()
    let disposables = [] as vscode.Disposable[]

    const manageEnablement = () => {
        if (getExtensionSetting('inlayHints.missingJsxAttributes.enabled')) {
            vscode.languages.registerInlayHintsProvider('typescriptreact,javascript,javascriptreact'.split(','), provider)
            vscode.languages.onDidChangeDiagnostics(e => {
                for (const uri of e.uris) {
                    if (uri === vscode.window.activeTextEditor?.document.uri) provider.eventEmitter.fire()
                }
            })
        } else {
            for (const d of disposables) d.dispose()
            disposables = []
        }
    }

    manageEnablement()
    watchExtensionSetting('inlayHints.missingJsxAttributes.enabled', manageEnablement)
}
