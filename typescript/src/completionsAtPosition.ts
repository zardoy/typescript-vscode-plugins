import _ from 'lodash'
import type tslib from 'typescript/lib/tsserverlibrary'
import * as emmet from '@vscode/emmet-helper'
import isInBannedPosition from './isInBannedPosition'
import { GetConfig } from './types'
import { findChildContainingPosition } from './utils'
import { isGoodPositionBuiltinMethodCompletion } from './isGoodPositionMethodCompletion'

export type PrevCompletionMap = Record<string, { originalName?: string; documentationOverride?: string | tslib.SymbolDisplayPart[] }>

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
          completions: tslib.CompletionInfo
          prevCompletionsMap: PrevCompletionMap
      }
    | undefined => {
    const prevCompletionsMap: PrevCompletionMap = {}
    const program = languageService.getProgram()
    const sourceFile = program?.getSourceFile(fileName)
    if (!program || !sourceFile) return
    if (!scriptSnapshot || isInBannedPosition(position, fileName, scriptSnapshot, sourceFile, languageService)) return
    let prior = languageService.getCompletionsAtPosition(fileName, position, options)
    // console.log(
    //     'raw prior',
    //     prior?.entries.map(entry => entry.name),
    // )
    const ensurePrior = () => {
        if (!prior) prior = { entries: [], isGlobalCompletion: false, isMemberCompletion: false, isNewIdentifierLocation: false }
        return true
    }
    const node = findChildContainingPosition(ts, sourceFile, position)
    if (['.jsx', '.tsx'].some(ext => fileName.endsWith(ext))) {
        // JSX Features
        if (node) {
            const { SyntaxKind } = ts
            const emmetSyntaxKinds = [SyntaxKind.JsxFragment, SyntaxKind.JsxElement, SyntaxKind.JsxText]
            const emmetClosingSyntaxKinds = [SyntaxKind.JsxClosingElement, SyntaxKind.JsxClosingFragment]
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

            if (
                c('jsxEmmet.type') !== 'disabled' &&
                (emmetSyntaxKinds.includes(node.kind) || /* Just before closing tag */ (emmetClosingSyntaxKinds.includes(node.kind) && nodeText.length === 0))
            ) {
                // const { textSpan } = proxy.getSmartSelectionRange(fileName, position)
                // let existing = scriptSnapshot.getText(textSpan.start, textSpan.start + textSpan.length)
                // if (existing.includes('\n')) existing = ''
                if (ensurePrior() && prior) {
                    // if (existing.startsWith('.')) {
                    //     const className = existing.slice(1)
                    //     prior.entries.push({
                    //         kind: typescript.ScriptElementKind.label,
                    //         name: className,
                    //         sortText: '!5',
                    //         insertText: `<div className="${className}">$1</div>`,
                    //         isSnippet: true,
                    //     })
                    // } else if (!existing[0] || existing[0].match(/\w/)) {
                    if (c('jsxEmmet.type') === 'realEmmet') {
                        const sendToEmmet = nodeText.split(' ').at(-1)!
                        const emmetCompletions = emmet.doComplete(
                            {
                                getText: () => sendToEmmet,
                                languageId: 'html',
                                lineCount: 1,
                                offsetAt: position => position.character,
                                positionAt: offset => ({ line: 0, character: offset }),
                                uri: '/',
                                version: 1,
                            },
                            { line: 0, character: sendToEmmet.length },
                            'html',
                            {},
                        ) ?? { items: [] }
                        for (const completion of emmetCompletions.items)
                            prior.entries.push({
                                kind: ts.ScriptElementKind.label,
                                name: completion.label.slice(1),
                                sortText: '!5',
                                // insertText: `${completion.label.slice(1)} ${completion.textEdit?.newText}`,
                                insertText: completion.textEdit?.newText,
                                isSnippet: true,
                                sourceDisplay: completion.detail !== undefined ? [{ kind: 'text', text: completion.detail }] : undefined,
                                // replacementSpan: { start: position - 5, length: 5 },
                            })
                    } else {
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
                }
            }
        }
    }

    if (!prior) return

    // const fullText = scriptSnapshot.getText(0, scriptSnapshot.getLength())
    // const matchImport = /(import (.*)from )['"].*['"]/.exec(fullText.split('\n')[line]!)?.[1]
    // if (matchImport && character <= `import${matchImport}`.length) {
    //     console.log('override')
    //     return
    // }
    // prior.isGlobalCompletion
    // prior.entries[0]
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
        const charAhead = scriptSnapshot.getText(position, position + 1)
        const bannedKeywords = [
            'true',
            'false',
            'undefined',
            'null',
            'never',
            'unknown',
            'any',
            'symbol',
            'string',
            'number',
            'boolean',
            'object',
            'this',
            'catch',
            'constructor',
            'continue',
            'break',
            'debugger',
            'default',
            'super',
            'import',
        ]
        prior.entries = prior.entries.map(entry => {
            if (entry.kind !== ts.ScriptElementKind.keyword || charAhead === ' ' || bannedKeywords.includes(entry.name)) return entry
            return { ...entry, insertText: `${entry.name} ` }
        })
    }

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
    if (!isGoodPositionBuiltinMethodCompletion(ts, sourceFile, position)) {
        prior.entries = prior.entries.map(item => ({ ...item, insertText: (item.insertText ?? item.name).replace(/\$/g, '\\$'), isSnippet: true }))
    }

    if (c('correctSorting.enable')) prior.entries = prior.entries.map((entry, index) => ({ ...entry, sortText: `${entry.sortText ?? ''}${index}` }))

    // console.log('signatureHelp', JSON.stringify(info.languageService.getSignatureHelpItems(fileName, position, {})))
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
