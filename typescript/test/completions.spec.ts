//@ts-ignore plugin expect it to set globallly
globalThis.__WEB__ = false
import { createLanguageService } from '../src/dummyLanguageService'
import { getCompletionsAtPosition as getCompletionsAtPositionRaw } from '../src/completionsAtPosition'
import type {} from 'vitest/globals'
import ts from 'typescript/lib/tsserverlibrary'
import { getDefaultConfigFunc } from './defaultSettings'
import { isGoodPositionBuiltinMethodCompletion, isGoodPositionMethodCompletion } from '../src/completions/isGoodPositionMethodCompletion'
import { getNavTreeItems } from '../src/getPatchedNavTree'
import { createRequire } from 'module'
import { findChildContainingPosition } from '../src/utils'
import handleCommand from '../src/specialCommands/handle'

const require = createRequire(import.meta.url)
//@ts-ignore plugin expect it to set globallly
globalThis.ts = ts

const entrypoint = '/test.tsx'
const files = { [entrypoint]: '' }

const { languageService, updateProject } = createLanguageService(files)

const getSourceFile = () => languageService.getProgram()!.getSourceFile(entrypoint)!
const getNode = (pos: number) => findChildContainingPosition(ts, getSourceFile(), pos)

const newFileContents = (contents: string, fileName = entrypoint) => {
    const cursorPositions: number[] = []
    const replacement = '/*|*/'
    let cursorIndex
    while ((cursorIndex = contents.indexOf(replacement)) !== -1) {
        contents = contents.slice(0, cursorIndex) + contents.slice(cursorIndex + replacement.length)
        cursorPositions.push(cursorIndex)
    }
    files[fileName] = contents
    updateProject()
    return cursorPositions
}

const fileContentsSpecialPositions = (contents: string, fileName = entrypoint) => {
    const cursorPositions: [number[], number[], number[]] = [[], [], []]
    const cursorPositionsOnly: [number[], number[], number[]] = [[], [], []]
    const replacement = /\/\*([tf\d]o?)\*\//g
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
        if (!isNaN(possiblyNum)) {
            addArr[2][possiblyNum] = offset
        } else {
            addArr[mainMatch === 't' ? '0' : '1'].push(offset)
        }
        replacement.lastIndex -= matchLength
    }
    files[fileName] = contents
    updateProject()
    if (cursorPositionsOnly.some(arr => arr.length)) {
        if (process.env.CI) throw new Error('Only positions not allowed on CI')
        return cursorPositionsOnly
    }
    return cursorPositions
}

const settingsOverride = {
    'arrayMethodsSnippets.enable': true,
}
//@ts-ignore
const defaultConfigFunc = await getDefaultConfigFunc(settingsOverride)

const getCompletionsAtPosition = (pos: number, fileName = entrypoint) => {
    if (pos === undefined) throw new Error('getCompletionsAtPosition: pos is undefined')
    const result = getCompletionsAtPositionRaw(fileName, pos, {}, defaultConfigFunc, languageService, ts.ScriptSnapshot.fromString(files[entrypoint]), ts)
    if (!result) return
    return {
        ...result,
        entries: result.completions.entries,
        entryNames: result.completions.entries.map(({ name }) => name),
    }
}

test('Banned positions', () => {
    const cursorPositions = newFileContents(/* ts */ `
    import /*|*/ from ''
      import /*|*/ from ''
    const a: {a: 5} = {/*|*/};
    `)
    for (const pos of [cursorPositions[0], cursorPositions[1]]) {
        const result = getCompletionsAtPosition(pos!)
        expect(result).toBeUndefined()
    }
    expect(getCompletionsAtPosition(cursorPositions[2]!)?.entries).toHaveLength(1)
})

test('Banned positions for all method snippets', () => {
    const cursorPositions = newFileContents(/* tsx */ `
        import {/*|*/} from 'test'
        const obj = { m$1e$2thod() {}, arrow: () => {} }
        type A = typeof obj["/*|*/"];
        const test = () => ({ method() {} })
        const {/*|*/} = test()
        const {something, met/*|*/} = test()
        test({
            method/*|*/
        })
        test({
            /*|*/
        })
        ;<Test/*|*/ />
        ;<Test/*|*/></Test>
        ;<Test test={/*|*/}></Test>
        ;<Test test={a/*|*/}></Test>
        ;<Test /*|*/></Test>
        ;<Test a={5} /*|*/ b></Test>
        ;<Test a/*|*/ />
    `)
    for (const [i, pos] of cursorPositions.entries()) {
        const result = isGoodPositionBuiltinMethodCompletion(ts, getSourceFile(), pos, defaultConfigFunc)
        expect(result, i.toString()).toBeFalsy()
    }
    const insertTextEscaping = getCompletionsAtPosition(cursorPositions[1]!)!.entries[1]?.insertText!
    expect(insertTextEscaping).toEqual('m\\$1e\\$2thod')
})

test('Not banned positions for method snippets', () => {
    const cursorPositions = newFileContents(/* ts */ `
        const test = () => ({ method() {} })
        const test2 = () => {}
        test({
            method: /*|*/
        })
        test({
            method: setTimeout/*|*/
        })
        test2/*|*/
    `)
    for (const [i, pos] of cursorPositions.entries()) {
        const result = isGoodPositionMethodCompletion(ts, entrypoint, getSourceFile(), pos - 1, languageService, defaultConfigFunc)
        expect(result, i.toString()).toBeTruthy()
    }
})

test('Function props: cleans & highlights', () => {
    const [pos, pos2] = newFileContents(/* ts */ `
        function fn() {}
        fn./*|*/
        let a: {
            (): void
            sync: 5
        }
        a./*|*/
    `)
    const entryNames = getCompletionsAtPosition(pos!)?.entryNames
    expect(entryNames).not.includes('Symbol')
    const entryNamesHighlighted = getCompletionsAtPosition(pos2!)?.entryNames
    expect(entryNamesHighlighted).includes('☆sync')
})

test('Emmet completion', () => {
    const [positivePositions, negativePositions, numPositions] = fileContentsSpecialPositions(/* tsx */ `
    // is it readable enough?
        ;<div>.test/*2*/</div>
        const a = <div d={/*f*/
        /*f*/<div>/*t*/ /*t*/test/*0*/
        /*t*/{}/*t*/ good ul>li/*1*/
        /*t*/</div>} >/*t*/</div>;
        const a = <div >/*t*/
        /*t*/</div>;

        const a = <div>/*t*/</div>
        const a = <div className={/*f*/}>/*t*/</div>
        const a = <span>/*t*/</span>
        const a = <>/*t*/</>
        const a = <React.Fragment/*f*/ key/*f*/>/*t*/</React.Fragment>
            `)
    const numPositionsTextLength = {
        0: -4,
        1: -5,
        2: -5,
    }
    const getEmmetCompletions = pos => {
        const result = handleCommand({ languageService } as any, entrypoint, pos, 'emmet-completions', defaultConfigFunc)
        return result?.typescriptEssentialsResponse?.emmetTextOffset
    }
    for (const [i, pos] of positivePositions.entries()) {
        expect(getEmmetCompletions(pos), i.toString()).toBe(0)
    }
    for (const [i, pos] of Object.entries(numPositions)) {
        expect(getEmmetCompletions(pos), i.toString()).toBe(numPositionsTextLength[i])
    }
    for (const [i, pos] of negativePositions.entries()) {
        expect(getEmmetCompletions(pos), i.toString()).toBeUndefined()
    }
})

test('Array Method Snippets', () => {
    const positions = newFileContents(/*ts*/ `
        const users = []
        users./*|*/
        ;users.filter(Boolean).flatMap/*|*/
    `)
    for (const [i, pos] of positions.entries()) {
        const { entries } = getCompletionsAtPosition(pos) ?? {}
        expect(entries?.find(({ name }) => name === 'flatMap')?.insertText, i.toString()).toBe('flatMap((${2:user}) => $3)')
    }
})

// TODO move/remove this test from here
test('Patched navtree (outline)', () => {
    globalThis.__TS_SEVER_PATH__ = require.resolve('typescript/lib/tsserver')
    newFileContents(/* tsx */ `
        const classes = {
            header: '...',
            title: '...'
        }
        function A() {
            return <Notification className="test another" id="yes">
                before
                <div id="ok">
                    <div />
                    <span class="good" />
                </div>
                after
            </Notification>
        }
    `)
    const navTreeItems: ts.NavigationTree = getNavTreeItems(ts, { languageService, languageServiceHost: {} } as any, entrypoint)
    const simplify = (items: ts.NavigationTree[]) => {
        const newItems: { text: any; childItems? }[] = []
        for (const { text, childItems } of items) {
            if (text === 'classes') continue
            newItems.push({ text, ...(childItems ? { childItems: simplify(childItems) } : {}) })
        }
        return newItems
    }
    expect(simplify(navTreeItems.childItems ?? [])).toMatchInlineSnapshot(/* json */ `
      [
        {
          "childItems": [
            {
              "childItems": [
                {
                  "childItems": [
                    {
                      "text": "div",
                    },
                    {
                      "text": "span.good",
                    },
                  ],
                  "text": "div#ok",
                },
              ],
              "text": "Notification.test.another#yes",
            },
          ],
          "text": "A",
        },
    ]
    `)
})
