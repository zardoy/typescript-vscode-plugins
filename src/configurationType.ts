import { ScriptElementKind } from 'typescript/lib/tsserverlibrary'

type ReplaceRule = {
    /** e.g. `readFile`, `^readFile` (global) or `fs.readFile` */
    suggestion: string
    filter?: {
        // package?: string
        // TODO
        kind?: keyof typeof ScriptElementKind
    }
    // action
    delete?: boolean
    duplicateOriginal?: boolean | 'above'
    patch?: Partial<{
        name: string
        kind: keyof typeof ScriptElementKind
        /** Might be useless when `correntSorting.enable` is true */
        sortText: string
        /** Generally not recommended */
        // kindModifiers: string
        insertText: string
    }>
    /** Works only with `correntSorting.enable` set to true (default) */
    // movePos?: number
    /** When specified, `movePos` is ignored */
    // TODO!
    // movePosAbsolute?: number
    // or
    // insertAfter?: string
    /** Not recommended to use as it would override possible `?` insertion */
    // replaceExisting?: string
}

// For easier testing, specify every default
// TODO support scripting
export type Configuration = {
    /**
     * Controls wether TypeScript Essentials plugin is enabled or not.
     * @default true
     */
    enablePlugin: boolean
    /**
     * Removes `Symbol`, `caller`, `prototype` everywhere
     * @default true
     *  */
    'removeUselessFunctionProps.enable': boolean
    /**
     * @default disable
     */
    'removeOrMarkGlobalCompletions.action': 'disable' | 'mark' | 'remove'
    /**
     * Useful for Number types.
     * Patch `toString()`: Removes arg tabstop
     * @default true
     */
    'patchToString.enable': boolean
    /**
     * Note: Please use `javascript`/`typescript.preferences.autoImportFileExcludePatterns` when possible, to achieve better performance!
     * e.g. instead of declaring `@mui/icons-material` here, declare `node_modules/@mui/icons-material` in aforementioned setting.
     *
     * And only use this, if auto-imports coming not from physical files (e.g. some modules node imports)
     * @default []
     */
    'suggestions.banAutoImportPackages': string[]
    /**
     * What insert text to use for keywords (e.g. `return`)
     * @default space
     */
    'suggestions.keywordsInsertText': 'none' | 'space'
    // TODO! corrent watching!
    /**
     * Wether to enable snippets for array methods like `items.map(item => )`
     * @default false
     */
    'arrayMethodsSnippets.enable': boolean
    /**
     * Add tabstop at arg so you can easily change it or add `i`
     * If set to `false`, arg is added without parentheses
     * @default true
     */
    'arrayMethodsSnippets.addArgTabStop': boolean
    /**
     * Add outer tabstop so you can easily pass callback instead
     * @default false
     */
    'arrayMethodsSnippets.addOuterTabStop': boolean
    /**
     * If set to `false` and singular item name can't be inffered, feature will be disabled
     * @default item
     */
    'arrayMethodsSnippets.defaultItemName': string | false
    /**
     * Highlight and lift non-function methods. Also applies for static class methods. Uses `bind`, `call`, `caller` detection.
     * @default true
     * */
    'highlightNonFunctionMethods.enable': boolean
    /**
     * Normalize sorting of suggestions after plugin modifications
     * You most probably don't need to disable it
     * @default true
     * */
    'correctSorting.enable': boolean
    /**
     * Try to restore suggestion sorting after `.`
     * Experimental and most probably will be changed in future
     * @default false
     */
    fixSuggestionsSorting: boolean
    // TODO
    /**
     * Mark QuickFixes & refactorings with 🔵
     * @default true
     */
    'markTsCodeActions.enable': boolean
    /**
     * Leave empty to disable
     * @default 🔵
     */
    'markTsCodeFixes.character': string
    // TODO
    /**
     * Reveal definition in import statement instead of real definition in another file
     * @default true
     *  */
    // 'importUpDefinition.enable': boolean
    /**
     * Remove definitions for TS module declarations e.g. *.css
     * Enable it if your first definition that receives focus is TS module declaration instead of target file itself
     * Might be really really useful in some cases
     * @default false
     */
    removeModuleFileDefinitions: boolean
    /**
     * Enable definitions for strings that appears to be paths (relatively to file)
     * Also must have and should be enabled if you work with path.join a lot
     * @default false
     */
    enableFileDefinitions: boolean
    /**
     * @default true
     * */
    'removeCodeFixes.enable': boolean
    /**
     * @default ["fixMissingFunctionDeclaration"]
     * @uniqueItems true
     *  */
    'removeCodeFixes.codefixes': ('fixMissingMember' | 'fixMissingProperties' | 'fixMissingAttributes' | 'fixMissingFunctionDeclaration')[]
    /**
     * Use full-blown emmet in jsx/tsx files!
     * Requires `jsxPseudoEmmet.enabled` to be disabled and `emmet.excludeLanguages` to have `javascriptreact` and `typescriptreact`
     * @default true
     * */
    'jsxEmmet.enable': boolean
    /**
     * Override snippet inserted on `.` literally
     * @default false
     */
    'jsxEmmet.dotOverride': string | false
    /**
     * We already change sorting of suggestions, but enabling this option will also make:
     * - removing `id` from input suggestions
     * - simplify textarea
     * Doesn't change preview text for now!
     * @default false
     */
    'jsxEmmet.modernize': boolean
    /**
     * Suggests only common tags such as div
     * @default false
     */
    'jsxPseudoEmmet.enable': boolean
    /**
     * Note: Sorting matters
     */
    'jsxPseudoEmmet.tags': { [tag: string]: true | string }
    /**
     * Exclude lowercase / incorrent suggestions
     * @default true
     */
    'jsxImproveElementsSuggestions.enabled': boolean
    /**
     * Recommended to enable to experience less uneeded suggestions unless you are using JSX Elements declared in namespaces
     * @default false
     */
    'jsxImproveElementsSuggestions.filterNamespaces': boolean
    /**
     * @default false
     */
    'experimentalPostfixes.enable': boolean
    /**
     * Disable specific postfixes from this plugin
     * @default []
     */
    'experimentalPostfixes.disablePostfixes': string[]
    /**
     * Requires TS server restart
     * @default false
     *  */
    // 'eventTypePatching.enable': boolean
    // 'globalTypedQuerySelector.enable': boolean,
    /**
     * For DX in JS projects only!
     * @default true
     */
    // 'wrapDefaultExports.enable': boolean,
    // 'wrapDefaultExports.map': {[relativePathGlob: string]: [string, string]},
    // 'specialGlobalTypes'
    // AS SEPARATE!
    // TODO
    /** Diagnostics (if not handled by eslint) & completions */
    // 'dotImportsMap.enable': boolean,
    /**
     * One of the most powerful setting here. It lets you remove/edit any suggestion that comes from TS. However its' experimental and can conflict with our completion changes.
     * **Please** try to always specify kind (e.g. variable) of the suggestion to ensure you don't remove word-suggestion or postfix snippet
     * @default []
     */
    replaceSuggestions: ReplaceRule[]
    /**
     * https://github.com/microsoft/vscode/issues/160637
     * @default true
     */
    removeDefinitionFromReferences: boolean
    /**
     * @default true
     */
    removeImportsFromReferences: boolean
    /**
     * Small definition improvements by cleaning them out:
     * - remove node_modules definition on React.FC component click
     * @default true
     */
    miscDefinitionImprovement: boolean
    /**
     * Experimental, feedback welcome
     * If default, namespace import or import path click resolves to .d.ts file, try to resolve .js file instead with the same name
     * @default false
     */
    changeDtsFileDefinitionToJs: boolean
    /**
     * Experimental. Also includes optional args
     * @default true
     */
    enableMethodSnippets: boolean
    /**
     * Wether to disable our and builtin method snippets within jsx attributes
     * @default true
     */
    // TODO add smart setting
    'disableMethodSnippets.jsxAttributes': boolean
    /**
     * Support `@ts-diagnostic-disable` top-level comment for disabling spefici semantic diagnostics
     * Example: `// @ts-diagnostic-disable
     * Advanced usage only! Enable in `.vscode/settings.json` for projects that need this
     * Since its changes only IDE experience, but not tsc
     * @default false
     */
    supportTsDiagnosticDisableComment: boolean
    /**
     * Adds special helpers completions in `{}`
     * For example when you're trying to complete object props in array
     * @default true
     */
    // completionHelpers: boolean
    /**
     * Extend TypeScript outline!
     * Extend outline with:
     * - JSX Elements
     * more coming soon...
     * Should be stable enough!
     * @default false
     */
    patchOutline: boolean
    /**
     * Exclude covered strings/enum cases in switch
     * @default true
     */
    switchExcludeCoveredCases: boolean
    /**
     * Disable useless highlighting,
     * @default disable
     */
    disableUselessHighlighting: 'disable' | 'inJsxArttributeStrings' | 'inAllStrings'
    /**
     * Improve JSX attribute completions:
     * - enable builtin jsx attribute completion fix
     * - enable jsxCompletionsMap
     * @default true
     */
    improveJsxCompletions: boolean
    /**
     * Replace JSX completions by map with `tagName#attribute` pattern as keys
     * `tagName` can be ommited, but not `attribute` for now
     * Example usages:
     * - `#className`: `insertText: "={classNames$1}"`
     * - `button#type`: `insertText: "='button'"`
     * - `#on*`: `insertText: "={${1:($2) => $3}}"`
     * - `Table#someProp`: `insertText: "="something"`
     * Remove attribute:
     * - `children`: `false`
     * @default {}
     */
    jsxCompletionsMap: {
        [rule: string]:
            | {
                  insertText: string
                  // TODO make it accept 'above'?
                  /**
                   * Make original suggestion keep below (true) or above patched
                   */
                  keepOriginal?: true | 'above'
              }
            | false
    }
    /**
     * The integration is enabled, only when this array is not empty
     * Integration supports only string within function call
     * Examples: `cp.exec(`, `executeShellCommand(`
     * @uniqueItems
     * @default []
     */
    'figIntegration.enableWhenStartsWith': string[]
    /**
     * Propose additional completions in object. Just like `typescript.suggest.objectLiteralMethodSnippets.enabled`, but also for string, arrays and objects
     * @default true
     */
    'objectLiteralCompletions.moreVariants': boolean
    /**
     * When `moreVariants` enabled, always add as fallback variant if other variant can't be derived
     * @default false
     */
    'objectLiteralCompletions.fallbackVariant': boolean
    /**
     * For `objectLiteralCompletions.moreVariants`, wether to insert newline for objects / arrays
     * @default true
     */
    'objectLiteralCompletions.insertNewLine': boolean
    /**
     * For `objectLiteralCompletions.moreVariants`
     * @default displayBelow
     */
    // 'objectLiteralCompletions.deepVariants': 'disable' | 'displayBelow' | 'replaceNotDeep'
    /**
     * Also affects builtin typescript.suggest.objectLiteralMethodSnippets, even when additional completions disabled
     * @default below
     */
    // TODO its a bug, change to after & before with fixed behavior
    'objectLiteralCompletions.keepOriginal': 'below' | 'above' | 'remove'
    /**
     * Wether to exclude non-JSX components completions in JSX component locations
     * Requires `completion-symbol` patch
     * @default false
     */
    'experiments.excludeNonJsxCompletions': boolean
}
