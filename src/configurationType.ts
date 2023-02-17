import { ScriptElementKind, ScriptKind } from 'typescript/lib/tsserverlibrary'

type ReplaceRule = {
    /**
     * Name of completion
     * e.g. `readFile`, `^readFile` (global) or `fs.readFile`
     */
    suggestion: string
    /**
     * Also its possible to specify any other completion properties. For example:
     * - sourceDisplay
     */
    filter?: {
        kind?: keyof Record<ScriptElementKind, string>
        fileNamePattern?: string
        languageMode?: keyof typeof ScriptKind
    }
    /** by default only first entry is proccessed */
    processMany?: boolean
    delete?: boolean
    /**
     * - true - original suggestion will be shown below current
     */
    duplicateOriginal?: boolean | 'above'
    patch?: Partial<{
        name: string
        kind: keyof typeof ScriptElementKind
        /** Might be useless when `correntSorting.enable` is true */
        sortText: string
        insertText: string | true
        /** Wether insertText differs from completion name */
        snippetLike: boolean
        labelDetails: {
            /** on the right */
            detail?: string
            description?: string
        }
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
     * Does not affect Vue support enablement
     * @default true
     */
    enablePlugin: boolean
    /**
     * Wether to enable support in Vue SFC files via Volar config file.
     * Changing setting false->true->false requires volar server restart
     * Experimental.
     * @default false
     */
    enableVueSupport: boolean
    /**
     * Temporary setting to enable loading config from other locations (also to expose plugin)
     */
    // volarLoadConfigPaths: string[]
    /**
     * Removes `Symbol`, `caller`, `prototype` everywhere
     * @default true
     *  */
    'removeUselessFunctionProps.enable': boolean
    /**
     * Of course it makes no sense to use `remove`, but `mark` might be really useful
     * @default disable
     */
    'removeOrMarkGlobalLibCompletions.action': 'disable' | 'mark' | 'remove'
    /**
     * Useful for Number types.
     * Patch `toString()`: Removes arg tabstop
     * @default true
     */
    'patchToString.enable': boolean
    /**
     * Format of this setting is very close to `jsxCompletionsMap` setting:
     * `path#symbol` (exact) or `path/*#symbol` (`#symbol` part can be ommited)
     *
     * Note: Please use `javascript`/`typescript.preferences.autoImportFileExcludePatterns` when possible, to achieve better performance!
     *
     * e.g. instead of declaring `@mui/icons-material` here, declare `node_modules/@mui/icons-material` in aforementioned setting.
     *
     * And only use this, if auto-imports coming not from physical files (e.g. some modules node imports)
     *
     * Examples:
     * - `path` - ignore path, but not path/posix or path/win32 modules
     * - `path/*` - ignore path, path/posix and path/win32
     * - `path/*#join` - ignore path, path/posix and path/win32, but only join symbol
     * - `path/*#join,resolve` - ignore path, path/posix and path/win32, but only join and resolve symbol
     *
     * - jquery/* - ignore absolutely all auto imports from jquery, even if it was declared virtually (declare module)
     * @default []
     */
    'suggestions.ignoreAutoImports': string[]
    /**
     * Disable it only if it causes problems / crashes with TypeScript, which of course should never happen
     * But it wasn't tested on very old versions
     * @default false
     */
    // 'advanced.disableAutoImportCodeFixPatching': boolean
    /**
     * What insert text to use for keywords (e.g. `return`)
     * @default space
     */
    'suggestions.keywordsInsertText': 'none' | 'space'
    /**
     * Will be `format-short` by default in future as super useful!
     * Requires TypeScript 5.0+
     * @default disable
     */
    'suggestions.displayImportedInfo': 'disable' | 'short-format' | 'long-format'
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
     * Additional file extension to include in completions (suggestions)
     *
     * **For unchecked files only**, for checked files use module augmentation.
     * Example: `["css"]` or `["*"]` that will include literally every file extension
     * @default []
     */
    additionalIncludeExtensions: string[]
    /**
     * Patterns to exclude from workspace symbol search
     * Example: `["**\/node_modules/**"]`
     * @uniqueItems true
     * @default ["**\/node_modules/**"]
     */
    workspaceSymbolSearchExcludePatterns: string[]
    /**
     * @default ["fixMissingFunctionDeclaration"]
     * @uniqueItems true
     *  */
    'removeCodeFixes.codefixes': FixId[]
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
     * - removes uppercase suggestions e.g. `Foo` (write React component name after `<` for proper completions)
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
     * Requires TS server restart. Recommended to enable only per project.
     *
     * Enables better lib.dom completions (such as input events). For JS projects only (that don't use `tsc`)!
     * @default false
     *  */
    libDomPatching: boolean
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
     * One of the most powerful setting here. It lets you remove/edit (patch) any completions that comes from TS. However it's experimental and can conflict with our completion changes (rare).
     * **Please** try to always specify kind (e.g. variable) of the suggestion to ensure you don't remove word-suggestion
     * @default []
     */
    replaceSuggestions: ReplaceRule[]
    /**
     * https://github.com/microsoft/vscode/issues/160637
     * @default true
     */
    removeDefinitionFromReferences: boolean
    /**
     * Make tsserver think signature help never gets triggered manually to make it not go outside of block eg:
     * ```ts
     * declare const a: (a) => void
     * a(() => {/* no annoying signature help on trigger *\/ })
     * ```
     * But it still allow it to be displayed in return statements which is more convenient
     * @recommended
     * @default false
     */
    'signatureHelp.excludeBlockScope': boolean
    /**
     * @default true
     */
    removeImportsFromReferences: boolean
    /**
     * Small definition improvements by cleaning them out:
     * - remove node_modules type definition on React.FC components (e.g. <Foo />)
     * - remove classes index definition on css modules (https://github.com/clinyong/vscode-css-modules/issues/63#issuecomment-1372851831)
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
     * - Type Alias Declarations
     * Should be stable!
     * @default false
     */
    patchOutline: boolean
    /**
     * Recommended to enable if you use `patchOutline`
     * @default false
     */
    'outline.arraysTuplesNumberedItems': boolean
    /**
     * Exclude covered strings/enum cases in switch in completions
     * @default true
     */
    switchExcludeCoveredCases: boolean
    /**
     * Make completions case-sensetive (see https://github.com/microsoft/TypeScript/issues/46622)
     * Might be enabled by default in future. Experimental as for now compares only start of completions.
     * Might require completion retrigger if was triggered by not quick suggestions.
     * @default false
     */
    caseSensitiveCompletions: boolean
    /**
     * Might be useful to enable for a moment. Note, that you can bind shortcuts within VSCode to quickly toggle settings like this
     * Also experimental and wasnt tested in all cases
     * Like described in `caseSensitiveCompletions` might require completion retrigger
     * @default false
     */
    disableFuzzyCompletions: boolean
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
     * Requires TypeScript 5.0+
     * @default false
     */
    'experiments.excludeNonJsxCompletions': boolean
    /**
     * Map *symbol - array of modules* to change sorting of imports - first available takes precedence in auto import code fixes (+ import all action)
     *
     * Examples:
     * - `join`: ['path/posix'] // other suggestions will be below
     * - `resolve`: ['*', 'path/posix'] // make `path/posix` appear below any other suggestions
     * - `useEventListener`: ['.'] // `.` (dot) is reserved for local suggestions, which makes them appear above other
     * @default {}
     */
    'autoImport.changeSorting': { [pathAndOrSymbol: string]: string[] }
    /**
     * Advanced. Use `suggestions.ignoreAutoImports` setting if possible.
     *
     * Specify packages to ignore in *add all missing imports* fix, to ensure these packages never get imported automatically.
     *
     * TODO syntaxes /* and module#symbol unsupported (easy)
     * @default []
     */
    'autoImport.alwaysIgnoreInImportAll': string[]
    /**
     * Specify here modules should be imported as namespace import. But note that imports gets processed first by `suggestions.ignoreAutoImports` anyway.
     *
     * @default {}
     */
    'autoImport.changeToNamespaceImport': {
        [module: string]: {
            /**
             * Defaults to key
             */
            namespace?: string
            /**
             * @default false
             */
            useDefaultImport?: boolean
            /**
             * Set to `false` if module is acessible from global variable
             * For now not supported in add all missing imports code action
             * @default true */
            addImport?: boolean
        }
    }
    /**
     * Enable to display additional information about source declaration in completion's documentation
     * For now only displays function's body
     * Requires TypeScript 5.0+
     * @default false
     */
    displayAdditionalInfoInCompletions: boolean
    /**
     * Wether to try to infer name for extract type / interface code action
     * e.g. `let foo: { a: number }` -> `type Foo = { a: number }`
     * @default true
     */
    'codeActions.extractTypeInferName': boolean
    /**
     * Use `{{name}}` as a placeholder to insert inferred name (possibly with _{i} at the end)
     *
     * @default "{{name}}"
     */
    'codeActions.extractTypeInferNamePattern':
        | string
        | {
              typeAlias: string
              interface: string
          }
}

// scrapped using search editor. config: caseInsesetive, context lines: 0, regex: const fix\w+ = "[^ ]+"
type FixId =
    | 'addConvertToUnknownForNonOverlappingTypes'
    | 'addMissingAsync'
    | 'addMissingAwait'
    | 'addMissingConst'
    | 'addMissingDeclareProperty'
    | 'addMissingInvocationForDecorator'
    | 'addNameToNamelessParameter'
    | 'annotateWithTypeFromJSDoc'
    | 'fixConvertConstToLet'
    | 'convertFunctionToEs6Class'
    | 'convertLiteralTypeToMappedType'
    | 'convertToAsyncFunction'
    | 'fixConvertToMappedObjectType'
    | 'convertToTypeOnlyExport'
    | 'convertToTypeOnlyImport'
    | 'correctQualifiedNameToIndexedAccessType'
    | 'disableJsDiagnostics'
    | 'disableJsDiagnostics'
    | 'addMissingConstraint'
    | 'fixMissingMember'
    | 'fixMissingProperties'
    | 'fixMissingAttributes'
    | 'fixMissingFunctionDeclaration'
    | 'addMissingNewOperator'
    | 'fixAddModuleReferTypeMissingTypeof'
    | 'addVoidToPromise'
    | 'addVoidToPromise'
    | 'fixAwaitInSyncFunction'
    | 'fixCannotFindModule'
    | 'installTypesPackage'
    | 'fixClassDoesntImplementInheritedAbstractMember'
    | 'fixClassIncorrectlyImplementsInterface'
    | 'classSuperMustPrecedeThisAccess'
    | 'constructorForDerivedNeedSuperCall'
    | 'enableExperimentalDecorators'
    | 'fixEnableJsxFlag'
    | 'fixExpectedComma'
    | 'extendsInterfaceBecomesImplements'
    | 'forgottenThisPropertyAccess'
    | 'fixImplicitThis'
    | 'fixImportNonExportedMember'
    | 'fixIncorrectNamedTupleSyntax'
    | 'invalidImportSyntax'
    | 'fixInvalidJsxCharacters_expression'
    | 'fixInvalidJsxCharacters_htmlEntity'
    | 'fixJSDocTypes_plain'
    | 'fixJSDocTypes_nullable'
    | 'fixMissingCallParentheses'
    | 'fixNaNEquality'
    | 'fixNoPropertyAccessFromIndexSignature'
    | 'fixOverrideModifier'
    | 'fixAddOverrideModifier'
    | 'fixRemoveOverrideModifier'
    | 'fixPropertyAssignment'
    | 'fixPropertyOverrideAccessor'
    | 'fixReturnTypeInAsyncFunction'
    | 'fixSpelling'
    | 'strictClassInitialization'
    | 'addMissingPropertyDefiniteAssignmentAssertions'
    | 'addMissingPropertyUndefinedType'
    | 'addMissingPropertyInitializer'
    | 'fixUnreachableCode'
    | 'fixUnreferenceableDecoratorMetadata'
    | 'unusedIdentifier'
    | 'unusedIdentifier_prefix'
    | 'unusedIdentifier_delete'
    | 'unusedIdentifier_deleteImports'
    | 'unusedIdentifier_infer'
    | 'fixUnusedLabel'
    | 'inferFromUsage'
    | 'removeAccidentalCallParentheses'
    | 'removeUnnecessaryAwait'
    | 'requireInTs'
    | 'returnValueCorrect'
    | 'fixAddReturnStatement'
    | 'fixRemoveBracesFromArrowFunctionBody'
    | 'fixWrapTheBlockWithParen'
    | 'splitTypeOnlyImport'
    | 'useBigintLiteral'
    | 'useDefaultImport'
    | 'wrapJsxInFragment'
