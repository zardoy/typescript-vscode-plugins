import type tslib from 'typescript/lib/tsserverlibrary'

export default (
    position: number,
    fileName: string,
    node: tslib.Node | undefined,
    sourceFile: tslib.SourceFile,
    program: tslib.Program,
    languageService: tslib.LanguageService,
    ts: typeof tslib,
) => {
    if (!node) return
}

// spec isnt strict as well
export const notStrictStringCompletion = (entry: tslib.CompletionEntry): tslib.CompletionEntry => ({
    ...entry,
    name: `◯${entry.name}`,
    insertText: entry.insertText ?? entry.name,
})
