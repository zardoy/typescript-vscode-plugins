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
     * Removes `Symbol`, `caller`, `prototype` everywhere
     * @default true
     *  */
    'removeUselessFunctionProps.enable': boolean
    /**
     * Useful for Number types.
     * Patch `toString()`: Removes arg tabstop
     * @default true
     */
    'patchToString.enable': boolean
    // TODO achieve perfomace by patching the host
    /** @default [] */
    'suggestions.banAutoImportPackages': string[]
    /**
     * What insert text to use for keywords (e.g. `return`)
     * @default space
     */
    'suggestions.keywordsInsertText': 'none' | 'space'
    // TODO! corrent watching!
    /**
     *
     * @default true
     */
    // 'patchArrayMethods.enable': boolean
    /**
     *  Highlight and lift non-function methods. Also applies for static class methods. Uses `bind`, `call`, `caller` detection.
     * @default true
     * */
    'highlightNonFunctionMethods.enable': boolean
    /**
     * Use originl sorting of suggestions (almost like in WebStorm). Works only with TypeScript <= 4.5.5
     * @default true
     * */
    'correctSorting.enable': boolean
    // TODO
    /**
     * Mark QuickFixes & refactorings with 🔵
     * @default true
     *  */
    'markTsCodeActions.enable': boolean
    /**
     * Leave empty to disable
     * @default 🔵
     */
    'markTsCodeFixes.character': string
    // TODO
    /**
     * Reveal import statement as definition instead of real definition
     * @default true
     *  */
    // 'importUpDefinition.enable': boolean
    /**
     * @default true
     *  */
    // 'postfixSupport.enable': boolean
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
     * Only tag support
     * @default fakeEmmet
     *  */
    'jsxEmmet.type': 'realEmmet' | 'fakeEmmet' | 'disabled'
    /**
     * Sorting matters
     */
    'jsxPseudoEmmet.tags': { [tag: string]: true | string }
    /**
     * Exclude lowercase / incorrent e.g. suggestions
     * @default true
     */
    'jsxImproveElementsSuggestions.enabled': boolean
    /**
     * Requires restart TS server
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
     * One of the most powerful setting here. It lets you remove/edit any suggestion that comes from TS.
     * **Please** try to always specify kind (e.g. variable) of the suggestion to ensure you don't remove word-suggestion or postfix snippet
     * @default []
     */
    replaceSuggestions: ReplaceRule[]
}
