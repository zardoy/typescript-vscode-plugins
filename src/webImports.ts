import * as vscode from 'vscode'
import { defaultJsSupersetLangsWithVue } from '@zardoy/vscode-utils/build/langs'
import { firstExists } from '@zardoy/vscode-utils/build/fs'
import { Utils } from 'vscode-uri'

export default () => {
    if (process.env.PLATFORM !== 'web') return
    vscode.languages.registerDefinitionProvider(defaultJsSupersetLangsWithVue, {
        async provideDefinition(document, position, token) {
            const importData = getModuleFromLine(document.lineAt(position).text)
            if (!importData) return
            const [beforeLength, importPath] = importData
            // +1 for quote
            const startPos = position.with(undefined, beforeLength + 1)
            const endPos = startPos.translate(0, importPath.length)
            const selectionRange = new vscode.Range(startPos, endPos)
            if (!selectionRange.contains(position)) return
            const importUri = vscode.Uri.joinPath(Utils.dirname(document.uri), importPath)
            // for now not going to make impl more complex as it would be removed soon anyway in favor of native TS support
            const extensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.d.ts', '.vue']
            const targetUri = await firstExists(
                ['', ...extensions, ...extensions.map(ext => `/index${ext}`)].map(ext => {
                    const uri = importUri.with({
                        path: `${importUri.path}${ext}`,
                    })
                    return { uri, name: uri, isFile: ext === '' || undefined }
                }),
            )
            if (!targetUri) return
            const startFilePos = new vscode.Position(0, 0)
            return [
                {
                    targetUri,
                    targetRange: new vscode.Range(startFilePos, startFilePos),
                    originSelectionRange: selectionRange,
                },
            ] as vscode.LocationLink[]
        },
    })
}

const getModuleFromLine = (line: string) => {
    // I just copy-pasted implementation from npm-rapid-ready, doesn't matter if it works in 99.99% cases
    const regexs = [/(import .*)(['"].*['"])/, /(} from )(['"].*['"])/]
    for (const regex of regexs) {
        const result = regex.exec(line)
        if (!result) continue
        return [result[1]!.length, result[2]!.slice(1, -1)] as const
    }

    return undefined
}
