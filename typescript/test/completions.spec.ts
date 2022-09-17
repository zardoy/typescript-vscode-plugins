import { createLanguageService } from '../src/dummyLanguageService'
import { getCompletionsAtPosition as getCompletionsAtPositionRaw } from '../src/completionsAtPosition'
import type {} from 'vitest/globals'
import ts from 'typescript/lib/tsserverlibrary'
import { getDefaultConfigFunc } from './defaultSettings'
import { isGoodPositionBuiltinMethodCompletion, isGoodPositionMethodCompletion } from '../src/isGoodPositionMethodCompletion'
import { getNavTreeItems } from '../src/getPatchedNavTree'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const entrypoint = '/test.tsx'
const files = { [entrypoint]: '' }

const { languageService, updateProject } = createLanguageService(files)

const getSourceFile = () => languageService.getProgram()!.getSourceFile(entrypoint)!

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

//@ts-ignore
const defaultConfigFunc = await getDefaultConfigFunc()

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

test('Builtin method snippet banned positions', () => {
    const cursorPositions = newFileContents(/* tsx */ `
        import {/*|*/} from 'test'
        const obj = { m$1e$2thod() {}, arrow: () => {} }
        type A = typeof obj["/*|*/"];
        const test = () => ({ method() {} })
        const {/*|*/} = test()
        const {something, met/*|*/} = test()
        ;<Test/*|*/ />
        ;<Test/*|*/></Test>
    `)
    for (const [i, pos] of cursorPositions.entries()) {
        const result = isGoodPositionBuiltinMethodCompletion(ts, getSourceFile(), pos)
        expect(result, i.toString()).toBeFalsy()
    }
    const insertTextEscaping = getCompletionsAtPosition(cursorPositions[1]!)!.entries[1]?.insertText!
    expect(insertTextEscaping).toEqual('m\\$1e\\$2thod')
})

test('Additional banned positions for our method snippets', () => {
    const cursorPositions = newFileContents(/* tsx */ `
        const test = () => ({ method() {} })
        test({
            method/*|*/
        })
        test({
            /*|*/
        })
        ;<Test/*|*/ />
        ;<Test/*|*/></Test>
    `)
    for (const [i, pos] of cursorPositions.entries()) {
        const result = isGoodPositionMethodCompletion(ts, entrypoint, getSourceFile(), pos - 1, languageService)
        expect(result, i.toString()).toBeFalsy()
    }
})

test('Not banned positions for our method snippets', () => {
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
        const result = isGoodPositionMethodCompletion(ts, entrypoint, getSourceFile(), pos - 1, languageService)
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

