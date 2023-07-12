import _ from 'lodash'
import { getCompletionsAtPosition as getCompletionsAtPositionRaw } from '../src/completionsAtPosition'
import { Configuration } from '../src/types'
import { defaultConfigFunc, entrypoint, sharedLanguageService, settingsOverride, currentTestingContext } from './shared'

interface CompletionPartMatcher {
    names?: string[]
    insertTexts?: string[]
    all?: Partial<Pick<ts.CompletionEntry, 'kind' | 'isSnippet'>>
}

interface CompletionMatcher {
    exact?: CompletionPartMatcher
    includes?: CompletionPartMatcher
    excludes?: string[]
}

interface CodeActionMatcher {
    refactorName: string
    /**
     * null - refactor is not expected
     */
    newContent: string | null
}

const { languageService, languageServiceHost, updateProject, getCurrentFile } = sharedLanguageService

export const getCompletionsAtPosition = (pos: number, { fileName = entrypoint, shouldHave }: { fileName?: string; shouldHave?: boolean } = {}) => {
    if (pos === undefined) throw new Error('getCompletionsAtPosition: pos is undefined')
    const result = getCompletionsAtPositionRaw(
        fileName,
        pos,
        {
            includeCompletionsWithInsertText: true,
            includeCompletionsWithObjectLiteralMethodSnippets: true,
            includeCompletionsWithSnippetText: true,
            includeCompletionsWithClassMemberSnippets: true,
            useLabelDetailsInCompletionEntries: true,
        },
        defaultConfigFunc,
        languageService,
        languageServiceHost.getScriptSnapshot(entrypoint)!,
        {
            convertTabsToSpaces: false,
        },
        { scriptKind: ts.ScriptKind.TSX, compilerOptions: {} },
    )
    if (shouldHave) expect(result).not.toBeUndefined()
    if (!result) return
    return {
        ...result,
        entries: result.completions.entries,
        /** Can be used in snapshots */
        entriesSorted: _.sortBy(result.completions.entries, ({ sortText }) => sortText)
            .map(({ sortText, ...rest }) => rest)
            .map(entry => Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined))) as ts.CompletionEntry[],
        entryNames: result.completions.entries.map(({ name }) => name),
    }
}

// shouldn't be used twice in the same test
export const overrideSettings = (newOverrides: Partial<Configuration>) => {
    const oldOverrides = { ...settingsOverride, ...Object.fromEntries(Object.entries(newOverrides).map(([key]) => [key, undefined])) }
    Object.assign(settingsOverride, newOverrides)
    let cleaned = false
    afterEach(() => {
        if (cleaned) return
        cleaned = true
        Object.assign(settingsOverride, oldOverrides)
    })
}

export const fourslashLikeTester = (contents: string, fileName = entrypoint) => {
    const [positive, _negative, numberedPositions] = fileContentsSpecialPositions(contents, fileName)

    const ranges = positive.reduce<number[][]>(
        (prevRanges, pos) => {
            const lastPrev = prevRanges[prevRanges.length - 1]!
            if (lastPrev.length < 2) {
                lastPrev.push(pos)
                return prevRanges
            }
            return [...prevRanges, [pos]]
        },
        [[]],
    )
    return {
        completion: (marker: number | number[], matcher: CompletionMatcher, meta?) => {
            for (const mark of Array.isArray(marker) ? marker : [marker]) {
                if (numberedPositions[mark] === undefined) throw new Error(`No marker ${mark} found`)
                const result = getCompletionsAtPosition(numberedPositions[mark]!, { shouldHave: true })!
                const message = ` at marker ${mark}`
                const { exact, includes, excludes } = matcher
                if (exact) {
                    const { names, all, insertTexts } = exact
                    if (names) {
                        expect(result?.entryNames, message).toEqual(names)
                    }
                    if (insertTexts) {
                        expect(
                            result.entries.map(entry => entry.insertText),
                            message,
                        ).toEqual(insertTexts)
                    }
                    if (all) {
                        for (const entry of result.entries) {
                            expect(entry, entry.name + message).toContain(all)
                        }
                    }
                }
                if (includes) {
                    const { names, all } = includes
                    if (names) {
                        for (const name of names) {
                            expect(result?.entryNames, message).toContain(name)
                        }
                    }
                    if (all) {
                        for (const entry of result.entries.filter(e => names?.includes(e.name))) {
                            expect(entry, entry.name + message).toContain(all)
                        }
                    }
                }
                if (excludes) {
                    expect(result?.entryNames, message).not.toContain(excludes)
                }
            }
        },
        codeAction: (marker: number | number[], matcher: CodeActionMatcher, meta?) => {
            for (const mark of Array.isArray(marker) ? marker : [marker]) {
                if (!ranges[mark]) throw new Error(`No range with index ${mark} found, highest index is ${ranges.length - 1}`)
                const start = ranges[mark]![0]!
                const end = ranges[mark]![0]!
                const appliableRefactors = languageService.getApplicableRefactors(fileName, { pos: start, end }, {}, 'invoked')
                const appliableNames = appliableRefactors.map(appliableRefactor => appliableRefactor.actions.map(action => action.description))
                const { refactorName, newContent } = matcher
                if (newContent) {
                    expect(appliableNames, `at marker ${mark}`).toContain(refactorName)
                    const actionsGroup = appliableRefactors.find(appliableRefactor =>
                        appliableRefactor.actions.find(action => action.description === refactorName),
                    )!
                    const action = actionsGroup.actions.find(action => action.description === refactorName)!
                    const { edits } = languageService.getEditsForRefactor(fileName, {}, { pos: start, end }, actionsGroup.name, action.name, {})!
                    const a = tsFull.textChanges.applyChanges(getCurrentFile(), edits[0]!.textChanges)
                } else {
                    expect(appliableNames, `at marker ${mark}`).not.toContain(refactorName)
                }
            }
        },
    }
}

export const fileContentsSpecialPositions = (contents: string, fileName = entrypoint) => {
    const cursorPositions: [number[], number[], number[]] = [[], [], []]
    const cursorPositionsOnly: [number[], number[], number[]] = [[], [], []]
    const replacement = /\/\*((t|f|\d+)o?)\*\//g
    let currentMatch: RegExpExecArray | null | undefined
    while ((currentMatch = replacement.exec(contents))) {
        const offset = currentMatch.index
        const matchLength = currentMatch[0]!.length
        contents = contents.slice(0, offset) + contents.slice(offset + matchLength)
        const addOnly = currentMatch[1]!.match(/o$/)?.[0]
        const addArr = addOnly ? cursorPositionsOnly : cursorPositions
        let mainMatch = currentMatch[1]!
        if (addOnly) mainMatch = mainMatch.slice(0, -1)
        const possiblyNum = +mainMatch
        if (!Number.isNaN(possiblyNum)) {
            addArr[2][possiblyNum] = offset
        } else {
            addArr[mainMatch === 't' ? '0' : '1'].push(offset)
        }
        replacement.lastIndex -= matchLength
    }
    updateProject({
        [fileName]: contents,
    })
    if (cursorPositionsOnly.some(arr => arr.length)) {
        if (process.env.CI) throw new Error('Only positions not allowed on CI')
        return cursorPositionsOnly
    }
    currentTestingContext.markers = cursorPositions[2]
    return cursorPositions
}
