// only for basic testing, as vscode is actually using server
import { nodeModules } from './utils'

export const createLanguageService = (files: Record<string, string>, { useLib = true }: { useLib?: boolean } = {}) => {
    const path = nodeModules!.path
    let dummyVersion = 1
    let defaultLibDir: string | undefined
    const languageService = ts.createLanguageService({
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
    })
    return {
        languageService,
        updateProject() {
            dummyVersion++
        },
    }
}
