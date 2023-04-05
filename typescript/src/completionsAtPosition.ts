import _ from 'lodash'
import { compact } from '@zardoy/utils'
import escapeStringRegexp from 'escape-string-regexp'
import inKeywordCompletions from './completions/inKeywordCompletions'
// import * as emmet from '@vscode/emmet-helper'
import isInBannedPosition from './completions/isInBannedPosition'
import { GetConfig } from './types'
import { findChildContainingExactPosition, findChildContainingPosition, isTs5, patchMethod } from './utils'
import indexSignatureAccessCompletions from './completions/indexSignatureAccess'
import fixPropertiesSorting from './completions/fixPropertiesSorting'
import { isGoodPositionMethodCompletion } from './completions/isGoodPositionMethodCompletion'
import improveJsxCompletions from './completions/jsxAttributes'
import arrayMethods from './completions/arrayMethods'
import prepareTextForEmmet from './specialCommands/prepareTextForEmmet'
import switchCaseExcludeCovered from './completions/switchCaseExcludeCovered'
import additionalTypesSuggestions from './completions/additionalTypesSuggestions'
import boostKeywordSuggestions from './completions/boostKeywordSuggestions'
import boostTextSuggestions from './completions/boostNameSuggestions'
import keywordsSpace from './completions/keywordsSpace'
import jsdocDefault from './completions/jsdocDefault'
import defaultHelpers from './completions/defaultHelpers'
import objectLiteralCompletions from './completions/objectLiteralCompletions'
import filterJsxElements from './completions/filterJsxComponents'
import markOrRemoveGlobalCompletions from './completions/markOrRemoveGlobalLibCompletions'
import adjustAutoImports from './completions/adjustAutoImports'
import addSourceDefinition from './completions/addSourceDefinition'
import { sharedCompletionContext } from './completions/sharedContext'
import displayImportedInfo from './completions/displayImportedInfo'
import changeKindToFunction from './completions/changeKindToFunction'
import functionPropsAndMethods from './completions/functionPropsAndMethods'
import { getTupleSignature } from './tupleSignature'
import stringTemplateTypeCompletions from './completions/stringTemplateType'
import localityBonus from './completions/localityBonus'

export type PrevCompletionMap = Record<
    string,
    {
        originalName?: string
        /** use only if codeactions cant be returned (no source) */
        documentationOverride?: string | ts.SymbolDisplayPart[]
        detailPrepend?: string
        documentationAppend?: string
        // textChanges?: ts.TextChange[]
    }
>
export type PrevCompletionsAdditionalData = {
    enableMethodCompletion: boolean
    completionsSymbolMap: Map</*entryName*/ string, Array<{ symbol: ts.Symbol; source?: string }>>
}

type GetCompletionAtPositionReturnType = {
    completions: ts.CompletionInfo
    /** Let default getCompletionEntryDetails to know original name or let add documentation from here */
    prevCompletionsMap: PrevCompletionMap
    prevCompletionsAdittionalData: PrevCompletionsAdditionalData
}

export const getCompletionsAtPosition = (
    fileName: string,
    position: number,
    options: ts.GetCompletionsAtPositionOptions | undefined,
    c: GetConfig,
    languageService: ts.LanguageService,
    scriptSnapshot: ts.IScriptSnapshot,
    formatOptions: ts.FormatCodeSettings | undefined,
    additionalData: { scriptKind: ts.ScriptKind; compilerOptions: ts.CompilerOptions },
): GetCompletionAtPositionReturnType | undefined => {
    const prevCompletionsMap: PrevCompletionMap = {}
    const program = languageService.getProgram()
    const sourceFile = program?.getSourceFile(fileName)
    if (!program || !sourceFile) return
    if (!scriptSnapshot || isInBannedPosition(position, scriptSnapshot, sourceFile)) return
    const exactNode = findChildContainingExactPosition(sourceFile, position)
    const isCheckedFile =
        !tsFull.isSourceFileJS(sourceFile as any) || !!tsFull.isCheckJsEnabledForFile(sourceFile as any, additionalData.compilerOptions as any)
    Object.assign(sharedCompletionContext, {
        position,
        languageService,
        sourceFile,
        program,
        isCheckedFile,
        node: exactNode,
        prevCompletionsMap,
        c,
        formatOptions: formatOptions || {},
        preferences: options || {},
    } satisfies typeof sharedCompletionContext)
    const unpatch = patchBuiltinMethods(c, languageService, isCheckedFile)
    const getPrior = () => {
        try {
            return languageService.getCompletionsAtPosition(
                fileName,
                position,
                {
                    ...options,
                    includeSymbol: true,
                },
                formatOptions,
            )
        } finally {
            unpatch?.()
        }
    }
    let prior = getPrior()
    const ensurePrior = () => {
        if (!prior) prior = { entries: [], isGlobalCompletion: false, isMemberCompletion: false, isNewIdentifierLocation: false }
        return true
    }
    const hasSuggestions = prior?.entries.some(({ kind }) => kind !== ts.ScriptElementKind.warning)
    const node = findChildContainingPosition(ts, sourceFile, position)

    /** node that is one character behind
     * useful as in most cases we work with node that is behind the cursor */
    const leftNode = findChildContainingPosition(ts, sourceFile, position - 1)
    if (
        node && // #region Fake emmet
        c('jsxPseudoEmmet.enable') &&
        leftNode &&
        prepareTextForEmmet(fileName, leftNode, sourceFile, position, languageService) !== false &&
        ensurePrior() &&
        prior
    ) {
        const tags = c('jsxPseudoEmmet.tags')
        for (let [tag, value] of Object.entries(tags)) {
            if (value === true) value = `<${tag}>$1</${tag}>`
            prior.entries.push({
                kind: ts.ScriptElementKind.label,
                name: tag,
                sortText: '!5',
                insertText: value,
                isSnippet: true,
            })
        }
    }
    // #endregion
    if (node && !hasSuggestions && ensurePrior() && prior) {
        prior.entries = additionalTypesSuggestions(prior.entries, program, node) ?? prior.entries
    }
    const addSignatureAccessCompletions = hasSuggestions ? [] : indexSignatureAccessCompletions()
    if (addSignatureAccessCompletions.length > 0 && ensurePrior() && prior) {
        prior.entries = [...prior.entries, ...addSignatureAccessCompletions]
    }

    if (leftNode) {
        const newEntries = boostTextSuggestions(prior?.entries ?? [], position, sourceFile, leftNode, languageService)
        if (newEntries?.length && ensurePrior() && prior) prior.entries = newEntries
    }

    if (!prior?.entries.length) {
        const addStringTemplateTypeCompletions = stringTemplateTypeCompletions()
        if (addStringTemplateTypeCompletions && ensurePrior() && prior) {
            prior.entries = [...prior.entries, ...addStringTemplateTypeCompletions]
        }
    }

    if (!prior) return

    if (c('tupleHelpSignature') && node) {
        const tupleSignature = getTupleSignature(node, program.getTypeChecker()!)
        if (tupleSignature) {
            const { currentHasLabel, currentMember, tupleMembers } = tupleSignature
            const tupleCurrentItem = tupleMembers[currentMember]
            if (currentHasLabel && tupleCurrentItem) {
                const name = tupleCurrentItem.split(':', 1)[0]!
                prior.entries.push({
                    name,
                    kind: ts.ScriptElementKind.warning,
                    sortText: '07',
                })
                prevCompletionsMap[name] ??= {}
                prevCompletionsMap[name]!.detailPrepend = `[${currentMember}]: ${tupleCurrentItem.slice(tupleCurrentItem.indexOf(':') + 2)}`
            }
        }
    }

    if (c('caseSensitiveCompletions')) {
        const fullText = sourceFile.getFullText()
        const currentWord = fullText.slice(0, position).match(/[\w\d]+$/)
        if (currentWord) {
            const firstEnteredChar = fullText.at(currentWord.index!) ?? ''
            /** @returns -1 - lowercase, 1 - uppercase, 0 - ignore */
            const getCharCasing = (char: string) => {
                if (char.toLocaleUpperCase() !== char) return -1
                if (char.toLocaleLowerCase() !== char) return 1
                return 0
            }
            const typedStartCasing = getCharCasing(firstEnteredChar)
            // check wether it is actually a case char and not a number for example
            if (typedStartCasing !== 0) {
                prior.entries = prior.entries.filter(entry => {
                    const entryCasing = getCharCasing(entry.name.at(0) ?? '')
                    if (entryCasing === 0) return true
                    return entryCasing === typedStartCasing
                })
            }
        }
    }

    if (c('disableFuzzyCompletions')) {
        const fullText = sourceFile.getFullText()
        const currentWord = fullText.slice(0, position).match(/[\w\d]+$/)
        if (currentWord) {
            prior.entries = prior.entries.filter(entry => {
                if (entry.name.startsWith(currentWord[0])) return true
                return false
            })
        }
    }

    prior.entries = fixPropertiesSorting(prior.entries) ?? prior.entries
    if (node) prior.entries = boostKeywordSuggestions(prior.entries, position, node) ?? prior.entries

    prior.entries = functionPropsAndMethods(prior.entries)

    // if (c('completionHelpers') && node) prior.entries = objectLiteralHelpers(node, prior.entries) ?? prior.entries

    if (c('patchToString.enable')) {
        //     const indexToPatch = arrayMoveItemToFrom(
        //         prior.entries,
        //         ({ name }) => name === 'toExponential',
        //         ({ name }) => name === 'toString',
        //     )
        const indexToPatch = prior.entries.findIndex(({ name, kind }) => name === 'toString' && kind !== ts.ScriptElementKind.warning)
        if (indexToPatch !== -1) {
            prior.entries[indexToPatch]!.insertText = `${prior.entries[indexToPatch]!.insertText ?? prior.entries[indexToPatch]!.name}()`
            prior.entries[indexToPatch]!.kind = ts.ScriptElementKind.constElement
            // prior.entries[indexToPatch]!.isSnippet = true
        }
    }

    if (node) prior.entries = defaultHelpers(prior.entries, node, languageService) ?? prior.entries
    if (exactNode) prior.entries = objectLiteralCompletions(prior.entries, exactNode, languageService, options ?? {}, c) ?? prior.entries
    // 90%
    prior.entries = adjustAutoImports(prior.entries)

    const inKeywordCompletionsResult = inKeywordCompletions()
    if (inKeywordCompletionsResult) {
        prior.entries.push(...inKeywordCompletionsResult.completions)
        Object.assign(
            prevCompletionsMap,
            _.mapValues(inKeywordCompletionsResult.docPerCompletion, value => ({
                documentationOverride: value,
            })),
        )
    }

    if (c('suggestions.keywordsInsertText') === 'space') {
        prior.entries = keywordsSpace(prior.entries, scriptSnapshot, position, exactNode)
    }

    if (leftNode && c('switchExcludeCoveredCases')) prior.entries = switchCaseExcludeCovered(prior.entries, position, sourceFile, leftNode) ?? prior.entries

    prior.entries = arrayMethods(prior.entries, position, sourceFile, c) ?? prior.entries
    prior.entries = jsdocDefault(prior.entries, position, sourceFile, languageService) ?? prior.entries

    // #region Vue (Volar) specific
    const isVueFile = fileName.endsWith('.vue.ts') || fileName.endsWith('.vue.js')
    if (isVueFile && exactNode) {
        let node = ts.isIdentifier(exactNode) ? exactNode.parent : exactNode
        if (ts.isPropertyAssignment(node)) node = node.parent
        if (
            ts.isObjectLiteralExpression(node) &&
            ts.isCallExpression(node.parent) &&
            ts.isIdentifier(node.parent.expression) &&
            node.parent.expression.text === 'defineComponent'
        ) {
            prior.entries = prior.entries.filter(({ name, kind }) => kind === ts.ScriptElementKind.warning || !name.startsWith('__'))
        }
    }
    // #endregion

    addSourceDefinition(prior.entries)
    displayImportedInfo(prior.entries)

    if (c('improveJsxCompletions') && leftNode) prior.entries = improveJsxCompletions(prior.entries, leftNode, position, sourceFile, c('jsxCompletionsMap'))

    prior.entries = localityBonus(prior.entries) ?? prior.entries

    const processedEntries = new Set<ts.CompletionEntry>()
    for (const rule of c('replaceSuggestions')) {
        if (rule.filter?.fileNamePattern) {
            // todo replace with something better
            const fileRegex = tsFull.getRegexFromPattern(tsFull.getPatternFromSpec(rule.filter.fileNamePattern, program.getCurrentDirectory(), 'files')!, false)
            if (fileRegex && !fileRegex.test(fileName)) continue
        }
        if (rule.filter?.languageMode && ts.ScriptKind[rule.filter.languageMode] !== additionalData.scriptKind) continue
        let nameComparator: (n: string) => boolean
        if (rule.suggestion.includes('*')) {
            const regex = new RegExp(`^${escapeStringRegexp(rule.suggestion).replaceAll('\\*', '.*')}$`)
            nameComparator = n => regex.test(n)
        } else {
            nameComparator = n => n === rule.suggestion
        }

        const entryIndexesToRemove: number[] = []
        const processEntryWithRule = (entryIndex: number) => {
            if (rule.delete) {
                entryIndexesToRemove.push(entryIndex)
                return
            }

            // todo-low (perf debt) clone probably should be used this
            const entry = prior!.entries[entryIndex]!
            if (rule.duplicateOriginal) {
                const duplicateEntry = { ...entry }
                prior!.entries.splice(rule.duplicateOriginal === 'above' ? entryIndex : entryIndex + 1, 0, duplicateEntry)
                processedEntries.add(duplicateEntry)
            }

            const { patch } = rule
            if (patch) {
                const { labelDetails, ...justPatch } = patch
                if (labelDetails) {
                    entry.labelDetails ??= {}
                    Object.assign(entry.labelDetails, labelDetails)
                }
                Object.assign(entry, justPatch)
            }
            if (patch?.insertText === true) {
                entry.insertText = entry.name
            }
            if (rule.patch?.insertText) entry.isSnippet = true
            processedEntries.add(entry)
        }

        entry: for (const [i, entry] of prior.entries.entries()) {
            if (processedEntries.has(entry)) continue
            const { name } = entry
            if (!nameComparator(name)) continue
            const { fileNamePattern, languageMode, ...simpleEntryFilters } = rule.filter ?? {}
            for (const [filterKey, filterValue] of Object.entries(simpleEntryFilters)) {
                if (entry[filterKey] !== filterValue) continue entry
            }
            processEntryWithRule(i)
            if (!rule.processMany) break
        }

        let iStep = 0
        for (const i of entryIndexesToRemove) {
            prior.entries.splice(i - iStep++, 1)
        }
    }

    // prevent vscode-builtin wrong insertText with methods snippets enabled
    const goodPositionForMethodCompletions = isGoodPositionMethodCompletion(sourceFile, position - 1, c)
    if (!goodPositionForMethodCompletions) {
        prior.entries = prior.entries.map(item => {
            if (item.isSnippet) return item
            return { ...item, insertText: (item.insertText ?? item.name).replace(/\$/g, '\\$'), isSnippet: true }
        })
    }

    if (prior.isGlobalCompletion) {
        prior.entries = markOrRemoveGlobalCompletions(prior.entries, position, languageService, c) ?? prior.entries
    }
    if (exactNode) {
        prior.entries = filterJsxElements(prior.entries, exactNode, position, languageService, c) ?? prior.entries
    }
    if (c('experiments.changeKindToFunction')) {
        prior.entries = changeKindToFunction(prior.entries)
    }

    if (c('correctSorting.enable')) {
        prior.entries = prior.entries.map(({ ...entry }, index) => ({
            ...entry,
            sortText: `${entry.sortText ?? ''}${index.toString().padStart(4, '0')}`,
        }))
    }

    const needsCompletionsSymbolMap = c('enableMethodSnippets')
    const completionsSymbolMap: PrevCompletionsAdditionalData['completionsSymbolMap'] = new Map()
    if (needsCompletionsSymbolMap) {
        for (const { name, source, symbol } of prior.entries) {
            if (!symbol) continue
            completionsSymbolMap.set(name, [
                ...(completionsSymbolMap.get(name) ?? []),
                {
                    symbol,
                    source,
                },
            ])
        }
    }

    // Otherwise may crash Volar
    prior.entries = prior.entries.map(entry => ({
        ...entry,
        symbol: undefined,
    }))

    return {
        completions: prior,
        prevCompletionsMap,
        prevCompletionsAdittionalData: {
            enableMethodCompletion: goodPositionForMethodCompletions,
            completionsSymbolMap,
        },
    }
}

const patchBuiltinMethods = (c: GetConfig, languageService: ts.LanguageService, isCheckedFile: boolean) => {
    if (isTs5() && (isCheckedFile || c('additionalIncludeExtensions').length === 0)) return

    let addFileExtensions: string[] | undefined
    const getAddFileExtensions = () => {
        const typeChecker = languageService.getProgram()!.getTypeChecker()!
        const ambientModules = typeChecker.getAmbientModules()
        /** file extensions from ambient modules declarations e.g. *.css */
        const fileExtensions = compact(
            ambientModules.map(module => {
                const name = module.name.slice(1, -1)
                if (!name.startsWith('*.') || name.includes('/')) return
                return name.slice(1)
            }),
        )
        if (!isCheckedFile) fileExtensions.push(...c('additionalIncludeExtensions').map(ext => (ext === '*' ? '' : ext)))
        return fileExtensions
    }
    // Its known that fuzzy completion don't work within import completions
    // TODO! when file name without with half-ending is typed it doesn't these completions! (seems ts bug, but probably can be fixed here)
    // e.g. /styles.css import './styles.c|' - no completions
    const unpatch = patchMethod(tsFull, 'getSupportedExtensions', (oldGetSupportedExtensions): any => (options, extraFileExtensions) => {
        addFileExtensions ??= getAddFileExtensions()
        // though extensions could be just inlined as is
        return oldGetSupportedExtensions(
            options,
            extraFileExtensions?.length
                ? extraFileExtensions
                : addFileExtensions.map(ext => ({
                      extension: ext,
                      isMixedContent: true,
                      scriptKind: ts.ScriptKind.Deferred,
                  })),
        )
    })
    return () => {
        unpatch()
    }
}
