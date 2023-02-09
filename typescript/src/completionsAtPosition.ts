import _ from 'lodash'
import inKeywordCompletions from './inKeywordCompletions'
// import * as emmet from '@vscode/emmet-helper'
import isInBannedPosition from './completions/isInBannedPosition'
import { GetConfig } from './types'
import { findChildContainingExactPosition, findChildContainingPosition } from './utils'
import indexSignatureAccessCompletions from './completions/indexSignatureAccess'
import fixPropertiesSorting from './completions/fixPropertiesSorting'
import { isGoodPositionBuiltinMethodCompletion } from './completions/isGoodPositionMethodCompletion'
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
import { compact, oneOf } from '@zardoy/utils'
import filterWIthIgnoreAutoImports from './completions/ignoreAutoImports'
import escapeStringRegexp from 'escape-string-regexp'
import addSourceDefinition from './completions/addSourceDefinition'

export type PrevCompletionMap = Record<string, { originalName?: string; documentationOverride?: string | ts.SymbolDisplayPart[]; documentationAppend?: string }>
export type PrevCompletionsAdditionalData = {
    enableMethodCompletion: boolean
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
):
    | {
          completions: ts.CompletionInfo
          /** Let default getCompletionEntryDetails to know original name or let add documentation from here */
          prevCompletionsMap: PrevCompletionMap
          prevCompletionsAdittionalData: PrevCompletionsAdditionalData
      }
    | undefined => {
    const prevCompletionsMap: PrevCompletionMap = {}
    const program = languageService.getProgram()
    const sourceFile = program?.getSourceFile(fileName)
    if (!program || !sourceFile) return
    if (!scriptSnapshot || isInBannedPosition(position, scriptSnapshot, sourceFile)) return
    const exactNode = findChildContainingExactPosition(sourceFile, position)
    const isCheckedFile =
        !tsFull.isSourceFileJS(sourceFile as any) || !!tsFull.isCheckJsEnabledForFile(sourceFile as any, additionalData.compilerOptions as any)
    const unpatch = patchBuiltinMethods(c, languageService, isCheckedFile)
    const getPrior = () => {
        try {
            return languageService.getCompletionsAtPosition(fileName, position, options, formatOptions)
        } finally {
            unpatch()
        }
    }
    let prior = getPrior()
    const ensurePrior = () => {
        if (!prior) prior = { entries: [], isGlobalCompletion: false, isMemberCompletion: false, isNewIdentifierLocation: false }
        return true
    }
    const hasSuggestions = prior && prior.entries.filter(({ kind }) => kind !== ts.ScriptElementKind.warning).length !== 0
    const node = findChildContainingPosition(ts, sourceFile, position)
    /** node that is one character behind
     * useful as in most cases we work with node that is behind the cursor */
    const leftNode = findChildContainingPosition(ts, sourceFile, position - 1)
    if (node) {
        // #region Fake emmet
        if (
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
    }
    if (node && !hasSuggestions && ensurePrior() && prior) {
        prior.entries = additionalTypesSuggestions(prior.entries, program, node) ?? prior.entries
    }
    const addSignatureAccessCompletions = hasSuggestions ? [] : indexSignatureAccessCompletions(position, node, scriptSnapshot, sourceFile, program)
    if (addSignatureAccessCompletions.length && ensurePrior() && prior) {
        prior.entries = [...prior.entries, ...addSignatureAccessCompletions]
    }

    if (leftNode) {
        const newEntries = boostTextSuggestions(prior?.entries ?? [], position, sourceFile, leftNode, languageService)
        if (newEntries?.length && ensurePrior() && prior) prior.entries = newEntries
    }

    if (!prior) return

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

    if (c('fixSuggestionsSorting')) prior.entries = fixPropertiesSorting(prior.entries, leftNode, sourceFile, program) ?? prior.entries
    if (node) prior.entries = boostKeywordSuggestions(prior.entries, position, node) ?? prior.entries

    const entryNames = new Set(prior.entries.map(({ name }) => name))
    if (c('removeUselessFunctionProps.enable')) {
        prior.entries = prior.entries.filter(entry => {
            if (oneOf(entry.kind, ts.ScriptElementKind.warning)) return true
            return !['Symbol', 'caller', 'prototype'].includes(entry.name)
        })
    }
    if (['bind', 'call', 'caller'].every(name => entryNames.has(name)) && c('highlightNonFunctionMethods.enable')) {
        const standardProps = new Set(['Symbol', 'apply', 'arguments', 'bind', 'call', 'caller', 'length', 'name', 'prototype', 'toString'])
        // TODO lift up!
        prior.entries = prior.entries.map(entry => {
            if (!standardProps.has(entry.name) && entry.kind !== ts.ScriptElementKind.warning) {
                const newName = `☆${entry.name}`
                prevCompletionsMap[newName] = {
                    originalName: entry.name,
                }
                return {
                    ...entry,
                    insertText: entry.insertText ?? entry.name,
                    name: newName,
                }
            }

            return entry
        })
    }

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
    prior.entries = filterWIthIgnoreAutoImports(prior.entries, languageService, c)

    const inKeywordCompletionsResult = inKeywordCompletions(position, node, sourceFile, program, languageService)
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

    prior.entries = addSourceDefinition(prior.entries, prevCompletionsMap, c) ?? prior.entries

    if (c('improveJsxCompletions') && leftNode) prior.entries = improveJsxCompletions(prior.entries, leftNode, position, sourceFile, c('jsxCompletionsMap'))

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

        entry: for (const [i, entry] of prior!.entries.entries()) {
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
    const goodPositionForMethodCompletions = isGoodPositionBuiltinMethodCompletion(ts, sourceFile, position - 1, c)
    if (!goodPositionForMethodCompletions) {
        prior.entries = prior.entries.map(item => {
            if (item.isSnippet) return item
            return { ...item, insertText: (item.insertText ?? item.name).replace(/\$/g, '\\$'), isSnippet: true }
        })
    }

    if (prior.isGlobalCompletion) prior.entries = markOrRemoveGlobalCompletions(prior.entries, position, languageService, c) ?? prior.entries
    if (exactNode) prior.entries = filterJsxElements(prior.entries, exactNode, position, languageService, c) ?? prior.entries

    if (c('correctSorting.enable')) {
        prior.entries = prior.entries.map(({ ...entry }, index) => ({
            ...entry,
            sortText: `${entry.sortText ?? ''}${index.toString().padStart(4, '0')}`,
            symbol: undefined,
        }))
    }
    return {
        completions: prior,
        prevCompletionsMap,
        prevCompletionsAdittionalData: {
            enableMethodCompletion: goodPositionForMethodCompletions,
        },
    }
}

type ArrayPredicate<T> = (value: T, index: number) => boolean
const arrayMoveItemToFrom = <T>(array: T[], originalItem: ArrayPredicate<T>, itemToMove: ArrayPredicate<T>) => {
    const originalItemIndex = array.findIndex(originalItem)
    if (originalItemIndex === -1) return undefined
    const itemToMoveIndex = array.findIndex(itemToMove)
    if (itemToMoveIndex === -1) return undefined
    array.splice(originalItemIndex, 0, array[itemToMoveIndex]!)
    array.splice(itemToMoveIndex + 1, 1)
    return originalItemIndex
}

const patchBuiltinMethods = (c: GetConfig, languageService: ts.LanguageService, isCheckedFile: boolean) => {
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
    const oldGetSupportedExtensions = tsFull.getSupportedExtensions
    Object.defineProperty(tsFull, 'getSupportedExtensions', {
        value: (options, extraFileExtensions) => {
            addFileExtensions ??= getAddFileExtensions()
            // though I extensions could be just inlined as is
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
        },
    })
    return () => {
        Object.defineProperty(tsFull, 'getSupportedExtensions', { value: oldGetSupportedExtensions })
    }
}
