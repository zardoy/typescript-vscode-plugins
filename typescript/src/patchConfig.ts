import { Configuration } from './types'

const excludeToDisable: Array<keyof Configuration> = ['enablePlugin', 'enableVueSupport']
const optionalExperiencesSettings: Partial<Configuration> = {
    'suggestions.keywordsInsertText': 'none',
    'markTsCodeFixes.character': '',
}

const recommendedSettings: Partial<Configuration> = {
    enableVueSupport: true,
    patchOutline: true,
    'arrayMethodsSnippets.enable': true,
    fixSuggestionsSorting: true,
    removeModuleFileDefinitions: true,
    enableFileDefinitions: true,
    workspaceSymbolSearchExcludePatterns: ['**/node_modules/**'],
    disableUselessHighlighting: 'inJsxArttributeStrings',
    'experiments.excludeNonJsxCompletions': true,
}

export default (config: Configuration) => {
    return config
}
