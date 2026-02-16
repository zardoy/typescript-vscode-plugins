import * as ts from 'typescript/lib/tsserverlibrary'
export type CodeFixInterface = {
    codes: number[]
    description?: string
    provideFix(diagnostic: ts.Diagnostic, startNode: ts.Node, sourceFile: ts.SourceFile, languageService: ts.LanguageService): ts.CodeFixAction | undefined
}
