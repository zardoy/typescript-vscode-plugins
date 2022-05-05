type ReplaceRule = {
    /** e.g. `readFile`, `^readFile` (global) or `fs.readFile` */
    suggestion: string
    /** @experimental Additional filter */
    package?: string
    // action
    remove?: boolean
    patch?: Partial<{
        name: string
        kind: string
        /** Might be useless when `correntSorting.enable` is true */
        sortText: string
        /** Generally not recommended */
        // kindModifiers: string
        insertText: string
    }>
    /** Works only with `correntSorting.enable` set to true (default) */
    movePos?: number
    // or
    insertAfter?: string
    /** Not recommended to use as it would override possible `?` insertion */
    // replaceExisting?: string
}

// TODO support scripting
export type Configuration = {
    /**
     * Removes `Symbol`, `caller`, `prototype`
     * @default true
     *  */
    'removeUselessFunctionProps.enable': boolean
    /**
     * Useful for Number types.
     * Patch `toString()`:
     * 1. Move it above others to...
     * 2. Remove arg tabstop
     * @default true
     */
    'patchToString.enable': boolean
    /**
     *
     * @default true
     */
    'patchArrayMethods.enable': boolean
    /**
     *  Highlight and lift non-function methods. Also applies for static class methods. Uses `bind`, `call`, `caller` detection.
     * @default true
     * */
    'highlightNonFunctionMethods.enable': boolean
    /**
     * Use originl sorting of suggestions (almost like in WebStorm)
     * @default true
     * */
    'correntSorting.enable': boolean
    // TODO
    /**
     * Mark QuickFixes & refactorings with 🔵
     * @default true
     *  */
    'markTsCodeActions.enable': boolean
    // TODO
    /**
     * Reveal import statement as definition instead of real definition
     * @default true
     *  */
    'importUpDefinition.enable': boolean
    /**
     * @default true
     *  */
    'postfixSupport.enable': boolean
    /**
     * @experimental
     * Only tag support
     * @default true
     *  */
    'jsxPseudoEmmet.enable': boolean
    /**
     * Sorting matters
     * @default { div: true, span: true, input: "<input $1/>", p:true, form: true, footer: true, section: true, select: true }
     */
    'jsxPseudoEmmet.tags': { [tag: string]: true | string }
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
    replaceSuggestions: ReplaceRule[]
}
