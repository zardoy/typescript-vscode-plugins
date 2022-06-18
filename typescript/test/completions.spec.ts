import { pickObj } from '@zardoy/utils'
import { createLanguageService } from '../src/dummyLanguageService'
import { getCompletionsAtPosition as getCompletionsAtPositionRaw } from '../src/completionsAtPosition'
import type {} from 'vitest/globals'
import ts from 'typescript/lib/tsserverlibrary'
import { getDefaultConfigFunc } from './defaultSettings'

const entrypoint = '/test.ts'
const files = { [entrypoint]: '' }

const { languageService, updateProject } = createLanguageService(files)

const newFileContents = (contents: string, fileName = entrypoint) => {
    const cursorPositions: number[] = []
    const replacement = '/*|*/'
    let cursorIndex
    while ((cursorIndex = contents.indexOf(replacement))) {
        if (cursorIndex === -1) break
        contents = contents.slice(0, cursorIndex) + contents.slice(cursorIndex + replacement.length)
        cursorPositions.push(cursorIndex)
    }
    files[fileName] = contents
    updateProject()
    return cursorPositions
}

//@ts-ignore
const defaultConfigFunc = await getDefaultConfigFunc()

const getCompletionsAtPosition = (pos: number, { fileName = entrypoint, shouldHave }: { fileName?: string; shouldHave?: boolean } = {}) => {
    if (pos === undefined) throw new Error('getCompletionsAtPosition: pos is undefined')
    const result = getCompletionsAtPositionRaw(fileName, pos, {}, defaultConfigFunc, languageService, ts.ScriptSnapshot.fromString(files[entrypoint]), ts)
    if (shouldHave) expect(result).not.toBeUndefined()
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

test.skip('Remove Useless Function Props', () => {
    const [pos] = newFileContents(/* ts */ `
        function fn() {}
        fn./*|*/
    `)
    const entryNames = languageService.getCompletionsAtPosition(entrypoint, pos, {})
    console.log(entryNames)
    // expect(entryNames).not.includes('bind')
})

test('In Keyword Completions', () => {
    const [pos] = newFileContents(/* ts */ `
        const a: { a: boolean, b: string } | { a: number, c: number } = {} as any
        if ('/*|*/' in a) {}
    `)
    const completion = pickObj(getCompletionsAtPosition(pos, { shouldHave: true })!, 'entries', 'prevCompletionsMap')
    expect(completion).toMatchInlineSnapshot(`
      {
        "entries": [
          {
            "insertText": "b",
            "kind": "string",
            "name": "☆b",
            "sortText": "1_10",
            "sourceDisplay": [
              {
                "kind": "text",
                "text": "1",
              },
            ],
          },
          {
            "insertText": "c",
            "kind": "string",
            "name": "☆c",
            "sortText": "1_21",
            "sourceDisplay": [
              {
                "kind": "text",
                "text": "2",
              },
            ],
          },
          {
            "insertText": "a",
            "kind": "string",
            "name": "a",
            "sortText": "2_02",
            "sourceDisplay": [
              {
                "kind": "text",
                "text": "1, 2",
              },
            ],
          },
        ],
        "prevCompletionsMap": {
          "a": {
            "documentationOverride": "1: boolean

      2: number",
          },
          "☆b": {
            "documentationOverride": "1: string",
          },
          "☆c": {
            "documentationOverride": "2: number",
          },
        },
      }
    `)
})
