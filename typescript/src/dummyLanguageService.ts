// only for basic testing, as vscode is actually using server
import ts from 'typescript/lib/tsserverlibrary'

export const createLanguageService = (files: Record<string, string>) => {
    const dummyVersion = '1'
    const languageService = ts.createLanguageService({
        getProjectVersion: () => dummyVersion,
        getScriptVersion: () => dummyVersion,
        getCompilationSettings: () => ({ allowJs: true, jsx: ts.JsxEmit.Preserve }),
        getScriptFileNames: () => Object.keys(files),
        getScriptSnapshot: fileName => {
            const contents = files[fileName]
            if (contents === undefined) return
            return ts.ScriptSnapshot.fromString(contents)
        },
        getCurrentDirectory: () => '',
        getDefaultLibFileName: () => 'defaultLib:lib.d.ts',
    })
    return languageService
}
