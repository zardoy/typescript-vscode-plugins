import { createLanguageService } from '../src/dummyLanguageService'
import { getCompletionsAtPosition as getCompletionsAtPositionRaw } from '../src/completionsAtPosition'
import type {} from 'vitest/globals'
import ts from 'typescript/lib/tsserverlibrary'
import { getDefaultConfigFunc } from './defaultSettings'
import { isGoodPositionBuiltinMethodCompletion, isGoodPositionMethodCompletion } from '../src/isGoodPositionMethodCompletion'

const entrypoint = '/test.ts'
const files = { [entrypoint]: '' }

const { languageService, updateProject } = createLanguageService(files)

const getSourceFile = () => languageService.getProgram()!.getSourceFile(entrypoint)!

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
    const cursorPositions = newFileContents(/* ts */ `
      import {/*|*/} from 'test'
      const obj = { m$1e$2thod() {}, arrow: () => {} }
      type A = typeof obj["/*|*/"];
      const test = () => ({ method() {} })
      const {/*|*/} = test()
      const {something, met/*|*/} = test()
    `)
    for (const [i, pos] of cursorPositions.entries()) {
        const result = isGoodPositionBuiltinMethodCompletion(ts, getSourceFile(), pos)
        expect(result, i.toString()).toBeFalsy()
    }
    const insertTextEscaping = getCompletionsAtPosition(cursorPositions[1]!)!.entries[1].insertText!
    expect(insertTextEscaping).toEqual('m\\$1e\\$2thod')
})

test('Additional banned positions for out method snippets', () => {
    const cursorPositions = newFileContents(/* ts */ `
        const test = () => ({ method() {} })
        test({
            method/*|*/
        })
        test({
            /*|*/
        })
    `)
    for (const [i, pos] of cursorPositions.entries()) {
        const result = isGoodPositionMethodCompletion(ts, entrypoint, getSourceFile(), pos, languageService)
        expect(result, i.toString()).toBeFalsy()
    }
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
