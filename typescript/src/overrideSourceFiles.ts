import { addObjectMethodResultInterceptors } from './utils'

let virtualFileContents = ''
let virtualFileVersion = 0

export const virtualFileName = '^/ideScripting.playground/ts-nul-authority/__virtual-file.ts'

let cachedInfo: ts.server.PluginCreateInfo

export const newVirtualFileContents = (contents: string) => {
    virtualFileContents = contents
    virtualFileVersion++
    const sourceFile = cachedInfo.languageService.getProgram()!.getSourceFile(virtualFileName)!
    const newSourceFile = ts.updateLanguageServiceSourceFile(sourceFile, ts.ScriptSnapshot.fromString(virtualFileContents), virtualFileVersion.toString(), {
        newLength: virtualFileContents.length,
        span: { start: 0, length: sourceFile.getText().length },
    })
    cachedInfo.languageService.getSmartSelectionRange(sourceFile.fileName, 0)
    return newSourceFile
}

export default (info: ts.server.PluginCreateInfo) => {
    cachedInfo = info
    // virtualFileName = info.languageServiceHost.getCurrentDirectory().replace(/\/$/, '') + '/__essentialPluginsVirtualFile__.ts'
    addObjectMethodResultInterceptors(info.languageServiceHost, {
        getScriptFileNames(files) {
            return [...files, virtualFileName]
        },
        getScriptVersion(result, fileName) {
            if (fileName === virtualFileName) {
                console.log('request file')
                return virtualFileVersion.toString()
            }
            return result
        },
        getScriptSnapshot(result, fileName) {
            if (fileName === virtualFileName) {
                return ts.ScriptSnapshot.fromString(virtualFileContents)
            }
            return result
        },
    })
}
