// only for basic testing, as vscode is actually using server
import { nodeModules } from './utils'

export const createLanguageService = (files: Record<string, string>, { useLib = true }: { useLib?: boolean } = {}, entrypoint?: string) => {
    const path = nodeModules!.path
    let dummyVersion = 1
    let defaultLibDir: string | undefined
    const languageServiceHost: ts.LanguageServiceHost = {
        getProjectVersion: () => dummyVersion.toString(),
        getScriptVersion: () => dummyVersion.toString(),
        getCompilationSettings: () => ({ allowJs: true, jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext }),
        getScriptFileNames: () => Object.keys(files),
        getScriptSnapshot: fileName => {
            let contents = files[fileName]
            if (useLib && path.dirname(fileName) === defaultLibDir) contents = ts.sys.readFile(fileName)
            if (contents === undefined) return
            return ts.ScriptSnapshot.fromString(contents)
        },
        getScriptKind(fileName) {
            return ts.ScriptKind.TSX
        },
        getCurrentDirectory: () => '',
        getDefaultLibFileName: options => {
            const defaultLibPath = ts.getDefaultLibFilePath(options)
            defaultLibDir = path.dirname(defaultLibPath)
            return defaultLibPath
        },
        fileExists(path) {
            return path in files
        },
        readFile(path) {
            return files[path]!
        },
    }
    const languageService = ts.createLanguageService(languageServiceHost)
    return {
        languageService,
        languageServiceHost,
        updateProject(newFiles?: Record<string, string> | string) {
            if (newFiles) {
                if (typeof newFiles === 'string') {
                    if (!entrypoint) throw new Error('entrypoint not set')
                    files = { [entrypoint!]: newFiles }
                } else {
                    Object.assign(files, newFiles)
                }
            }
            dummyVersion++
        },
        getCurrentFile() {
            if (!entrypoint) throw new Error('entrypoint not set')
            return files[entrypoint!]!
        },
    }
}
