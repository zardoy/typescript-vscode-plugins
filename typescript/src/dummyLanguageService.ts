// only for basic testing, as vscode is actually using server
import ts from 'typescript/lib/tsserverlibrary'

export const createLanguageService = (files: Record<string, string>) => {
    let dummyVersion = 1
    const languageService = ts.createLanguageService({
        getProjectVersion: () => dummyVersion.toString(),
        getScriptVersion: () => dummyVersion.toString(),
        getCompilationSettings: () => ({ allowJs: true, jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext }),
        getScriptFileNames: () => Object.keys(files),
        getScriptSnapshot: fileName => {
            const contents = files[fileName]
            if (contents === undefined) return
            return ts.ScriptSnapshot.fromString(contents)
        },
        getCurrentDirectory: () => '',
        getDefaultLibFileName: () => require.resolve('typescript/lib/lib.esnext.full.d.ts'),
    })
    return {
        languageService,
        updateProject() {
            dummyVersion++
        },
    }
}
