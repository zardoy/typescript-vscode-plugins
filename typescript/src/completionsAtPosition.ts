import _ from 'lodash'
import type tslib from 'typescript/lib/tsserverlibrary'
// import * as emmet from '@vscode/emmet-helper'
import isInBannedPosition from './completions/isInBannedPosition'
import { GetConfig } from './types'
import { findChildContainingPosition } from './utils'
import indexSignatureAccessCompletions from './completions/indexSignatureAccess'
import fixPropertiesSorting from './completions/fixPropertiesSorting'
import { isGoodPositionBuiltinMethodCompletion } from './completions/isGoodPositionMethodCompletion'
import improveJsxCompletions from './completions/jsxAttributes'
import arrayMethods from './completions/arrayMethods'
import prepareTextForEmmet from './specialCommands/prepareTextForEmmet'
import objectLiteralHelpers from './completions/objectLiteralHelpers'
import switchCaseExcludeCovered from './completions/switchCaseExcludeCovered'
import additionalTypesSuggestions from './completions/additionalTypesSuggestions'
import boostKeywordSuggestions from './completions/boostKeywordSuggestions'
import boostTextSuggestions from './completions/boostNameSuggestions'
import keywordsSpace from './completions/keywordsSpace'

export type PrevCompletionMap = Record<string, { originalName?: string; documentationOverride?: string | ts.SymbolDisplayPart[] }>

export const getCompletionsAtPosition = (
    fileName: string,
    position: number,
    options: ts.GetCompletionsAtPositionOptions | undefined,
    c: GetConfig,
    languageService: ts.LanguageService,
    scriptSnapshot: ts.IScriptSnapshot,
    ts: typeof tslib,
):
    | {
          completions: ts.CompletionInfo
          /** Let default getCompletionEntryDetails to know original name or let add documentation from here */
          prevCompletionsMap: PrevCompletionMap
      }
    | undefined => {
    const prevCompletionsMap: PrevCompletionMap = {}
    const program = languageService.getProgram()
    const sourceFile = program?.getSourceFile(fileName)
    if (!program || !sourceFile) return
    if (!scriptSnapshot || isInBannedPosition(position, scriptSnapshot, sourceFile)) return
    let prior = languageService.getCompletionsAtPosition(fileName, position, options)
    const ensurePrior = () => {
        if (!prior) prior = { entries: [], isGlobalCompletion: false, isMemberCompletion: false, isNewIdentifierLocation: false }
        return true
    }
    const hasSuggestions = prior && prior.entries.filter(({ kind }) => kind !== ts.ScriptElementKind.warning).length !== 0
    const node = findChildContainingPosition(ts, sourceFile, position)
    /** node that is one character behind
     * useful as in most cases we work with node that is behind the cursor */
    const leftNode = findChildContainingPosition(ts, sourceFile, position - 1)
    const tokenAtPosition = tsFull.getTokenAtPosition(sourceFile as any, position) as ts.Node
    if (['.jsx', '.tsx'].some(ext => fileName.endsWith(ext))) {
        // #region JSX tag improvements
        if (node) {
            const { SyntaxKind } = ts
            // TODO maybe allow fragment?
            const correntComponentSuggestionsKinds = [SyntaxKind.JsxOpeningElement, SyntaxKind.JsxSelfClosingElement]
            const nodeText = node.getFullText().slice(0, position - node.pos)
            if (correntComponentSuggestionsKinds.includes(node.kind) && c('jsxImproveElementsSuggestions.enabled') && !nodeText.includes(' ') && prior) {
                let lastPart = nodeText.split('.').at(-1)!
                if (lastPart.startsWith('<')) lastPart = lastPart.slice(1)
                const isStartingWithUpperCase = (str: string) => str[0] === str[0]?.toUpperCase()
                // check if starts with lowercase
                if (isStartingWithUpperCase(lastPart))
                    // TODO! compare with suggestions from lib.dom
                    prior.entries = prior.entries.filter(
                        entry => isStartingWithUpperCase(entry.name) && ![ts.ScriptElementKind.enumElement].includes(entry.kind),
                    )
            }
            // #endregion

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
    }
    if (leftNode && !hasSuggestions && ensurePrior() && prior) {
        prior.entries = additionalTypesSuggestions(prior.entries, program, leftNode) ?? prior.entries
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

    if (c('fixSuggestionsSorting')) prior.entries = fixPropertiesSorting(prior.entries, leftNode, sourceFile, program) ?? prior.entries
    if (node) prior.entries = boostKeywordSuggestions(prior.entries, position, node) ?? prior.entries

    const entryNames = new Set(prior.entries.map(({ name }) => name))
    if (c('removeUselessFunctionProps.enable')) prior.entries = prior.entries.filter(e => !['Symbol', 'caller', 'prototype'].includes(e.name))
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
        const indexToPatch = prior.entries.findIndex(({ name }) => name === 'toString')
        if (indexToPatch !== -1) {
            prior.entries[indexToPatch]!.insertText = `${prior.entries[indexToPatch]!.insertText ?? prior.entries[indexToPatch]!.name}()`
            prior.entries[indexToPatch]!.kind = ts.ScriptElementKind.constElement
            // prior.entries[indexToPatch]!.isSnippet = true
        }
    }

    const banAutoImportPackages = c('suggestions.banAutoImportPackages')
    if (banAutoImportPackages?.length)
        prior.entries = prior.entries.filter(entry => {
            if (!entry.sourceDisplay) return true
            const text = entry.sourceDisplay.map(item => item.text).join('')
            if (text.startsWith('.')) return true
            // TODO change to startsWith?
            return !banAutoImportPackages.includes(text)
        })

    if (c('suggestions.keywordsInsertText') === 'space') {
        prior.entries = keywordsSpace(prior.entries, scriptSnapshot, position, tokenAtPosition)
    }

    if (leftNode && c('switchExcludeCoveredCases')) prior.entries = switchCaseExcludeCovered(prior.entries, position, sourceFile, leftNode) ?? prior.entries

    prior.entries = arrayMethods(prior.entries, position, sourceFile, c) ?? prior.entries

    if (c('improveJsxCompletions') && leftNode) prior.entries = improveJsxCompletions(prior.entries, leftNode, position, sourceFile, c('jsxCompletionsMap'))

    for (const rule of c('replaceSuggestions')) {
        let foundIndex: number
        const suggestion = prior.entries.find(({ name, kind }, index) => {
            if (rule.suggestion !== name) return false
            if (rule.filter?.kind && kind !== rule.filter.kind) return false
            foundIndex = index
            return true
        })
        if (!suggestion) continue

        if (rule.delete) prior.entries.splice(foundIndex!, 1)

        if (rule.duplicateOriginal) prior.entries.splice(rule.duplicateOriginal === 'above' ? foundIndex! : foundIndex! + 1, 0, { ...suggestion })

        Object.assign(suggestion, rule.patch ?? {})
        if (rule.patch?.insertText) suggestion.isSnippet = true
    }

    // prevent vscode-builtin wrong insertText with methods snippets enabled
    if (!isGoodPositionBuiltinMethodCompletion(ts, sourceFile, position - 1, c)) {
        prior.entries = prior.entries.map(item => {
            if (item.isSnippet) return item
            return { ...item, insertText: (item.insertText ?? item.name).replace(/\$/g, '\\$'), isSnippet: true }
        })
    }

    if (c('correctSorting.enable')) prior.entries = prior.entries.map((entry, index) => ({ ...entry, sortText: `${entry.sortText ?? ''}${index}` }))

    // console.log('signatureHelp', JSON.stringify(languageService.getSignatureHelpItems(fileName, position, {})))
    return {
        completions: prior,
        prevCompletionsMap,
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

const patchText = (input: string, start: number, end: number, newText: string) => input.slice(0, start) + newText + input.slice(end)
