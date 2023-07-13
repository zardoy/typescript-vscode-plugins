import { PrevCompletionMap } from '../completionsAtPosition'
import { GetConfig } from '../types'

/** Must be used within functions */
export const sharedCompletionContext = {} as unknown as Readonly<{
    prior: ts.CompletionInfo
    position: number
    sourceFile: ts.SourceFile
    program: ts.Program
    node: ts.Node | undefined
    languageService: ts.LanguageService
    isCheckedFile: boolean
    prevCompletionsMap: PrevCompletionMap
    c: GetConfig
    formatOptions: ts.FormatCodeSettings
    preferences: ts.UserPreferences
    // languageServiceHost: ts.LanguageServiceHost
}>
