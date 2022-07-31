// only for basic testing, as vscode is actually using server
import ts from 'typescript/lib/tsserverlibrary'
import path from 'path'
import fs from 'fs'

export const createLanguageService = (files: Record<string, string>) => {
    let dummyVersion = 1
    let defaultLibDir: string | undefined
    const languageService = ts.createLanguageService({
        getProjectVersion: () => dummyVersion.toString(),
        getScriptVersion: () => dummyVersion.toString(),
        getCompilationSettings: () => ({ allowJs: true, jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext }),
        getScriptFileNames: () => Object.keys(files),
        getScriptSnapshot: fileName => {
            let contents = files[fileName]
            if (path.dirname(fileName) === defaultLibDir) contents = ts.sys.readFile(fileName)
            if (contents === undefined) return
            return ts.ScriptSnapshot.fromString(contents)
        },
        getCurrentDirectory: () => '',
        getDefaultLibFileName: options => {
            const defaultLibPath = ts.getDefaultLibFilePath(options)
            defaultLibDir = path.dirname(defaultLibPath)
            return defaultLibPath
        },
    })
    return {
        languageService,
        updateProject() {
            dummyVersion++
        },
    }
}
