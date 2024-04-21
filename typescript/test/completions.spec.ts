import { pickObj } from '@zardoy/utils'
import type {} from 'vitest/globals'
import _ from 'lodash'
import { isGoodPositionMethodCompletion } from '../src/completions/isGoodPositionMethodCompletion'
import { findChildContainingExactPosition, isTs5 } from '../src/utils'
import handleCommand from '../src/specialCommands/handle'
import constructMethodSnippet from '../src/constructMethodSnippet'
import { currentTestingContext, defaultConfigFunc, entrypoint, settingsOverride, sharedLanguageService } from './shared'
import { fileContentsSpecialPositions, fourslashLikeTester, getCompletionsAtPosition, overrideSettings } from './testing'

const { languageService, languageServiceHost, updateProject, getCurrentFile } = sharedLanguageService

const getSourceFile = () => languageService.getProgram()!.getSourceFile(entrypoint)!
const getNode = (pos: number) => findChildContainingExactPosition(getSourceFile(), pos)

const newFileContents = (contents: string, fileName = entrypoint) => {
    const cursorPositions: number[] = []
    const replacement = '/*|*/'
    let cursorIndex
    while ((cursorIndex = contents.indexOf(replacement)) !== -1) {
        contents = contents.slice(0, cursorIndex) + contents.slice((cursorIndex as number) + replacement.length)
        cursorPositions.push(cursorIndex)
    }
    updateProject({
        [fileName]: contents,
    })
    return cursorPositions
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

test.todo('Const name suggestions (boostNameSuggestions)', () => {
    const tester = fourslashLikeTester(/* ts */ `
    const /*0*/ = 5
    testVariable
    `)
    languageService.getSemanticDiagnostics(entrypoint)
    tester.completion(0, {
        includes: {
            names: ['testVariable'],
        },
    })
})

test('Banned positions for all method snippets', () => {
    const cursorPositions = newFileContents(/* tsx */ `
        import {/*|*/} from 'test'
        const obj = { m$1e$2thod() {}, arrow: () => {} }
        type A = typeof obj["/*|*/"];
        export {/*|*/} from 'test'
        a(({ a/*|*/ }) => {})
        const test = () => ({ method() {} })
        const {/*|*/} = test()
        const {something, met/*|*/} = test()
        test({
            method/*|*/
        })
        test({
            /*|*/
        })
        test/*|*/ = test
        ;<Test/*|*/ />
        ;<Test/*|*/></Test>
        ;<Test test={/*|*/}></Test>
        ;<Test test={a/*|*/}></Test>
        ;<Test /*|*/></Test>
        ;<Test a={5} /*|*/ b></Test>
        ;<Test a/*|*/ />
    `)
    for (const [i, pos] of cursorPositions.entries()) {
        const result = isGoodPositionMethodCompletion(getSourceFile(), pos - 1, defaultConfigFunc)
        expect(result, i.toString()).toBeFalsy()
    }
    const insertTextEscaping = getCompletionsAtPosition(cursorPositions[1]!)!.entries[1]?.insertText
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
        test = test/*|*/
        test/*|*/ >= test/*|*/
    `)
    for (const [i, pos] of cursorPositions.entries()) {
        const result = isGoodPositionMethodCompletion(getSourceFile(), pos - 1, defaultConfigFunc)
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

const compareMethodSnippetAgainstMarker = (inputMarkers: number[], marker: number, expected: string | null | string[]) => {
    const obj = Object.fromEntries(inputMarkers.entries())
    const markerPos = obj[marker]!
    const resolvedData = {
        isAmbiguous: false,
    }
    const methodSnippet = constructMethodSnippet(languageService, getSourceFile(), markerPos, undefined, defaultConfigFunc, resolvedData)
    if (resolvedData.isAmbiguous) {
        expect('ambiguous').toEqual(expected)
        return
    }
    const snippetToInsert = methodSnippet ? `(${methodSnippet.join(', ')})` : null
    expect(Array.isArray(expected) ? methodSnippet : snippetToInsert, `At marker ${marker}`).toEqual(expected)
}

const assertCompletionInsertText = (marker: number, entryPredicate: string | undefined | number, insertTextExpected: string) => {
    const { entries } = getCompletionsAtPosition(currentTestingContext.markers[marker]!)!
    const entry = typeof entryPredicate === 'string' ? entries.find(({ name }) => name === entryPredicate) : entries[entryPredicate ?? 0]
    expect(entry?.insertText).toEqual(insertTextExpected)
}

describe('Method snippets', () => {
    test('Misc', () => {
        const [, _, markers] = fileContentsSpecialPositions(/* ts */ `
            type A = () => void
            // don't complete for types
            type B = A/*1*/;

            declare const a: A
            a/*2*/

            // overload
            function foo(this: {}, a)
            function foo(this: {}, b)
            function foo(this: {}) {}
            foo/*3*/

            // new class
            new Something(foo/*301*/)

            // contextual type
            declare const bar: {
                b: (a) => {}
                c
            } | {
                b: ($b) => {}
                d
            }
            if ('d' in bar) {
                bar.b/*4*/
            }

            // default insert text = binding-name
            declare const baz: {
                (a: string = "test", b?, {
                    d = false,
                    e: {}
                } = {}, ...c): void
            }
            baz/*5*/

            // should ignores comments
            declare const withComments = (
                a: boolean,
                // comment
                b: boolean,
                /* jsdoc */
                c: boolean
            ) => void

            withComments/*6*/
        `)

        compareMethodSnippetAgainstMarker(markers, 1, null)
        compareMethodSnippetAgainstMarker(markers, 2, '()')
        compareMethodSnippetAgainstMarker(markers, 3, '(a)')
        compareMethodSnippetAgainstMarker(markers, 301, '(a)')
        compareMethodSnippetAgainstMarker(markers, 4, '($b)')
        compareMethodSnippetAgainstMarker(markers, 5, '(a, b, { d, e: {} }, ...c)')
        compareMethodSnippetAgainstMarker(markers, 6, '(a, b, c)')
    })

    test('Class', () => {
        const [, _, markers] = fileContentsSpecialPositions(/* ts */ `
            class A {
                constructor(a) {}
            }

            class B {
                protected constructor(a) {}
            }

            class C {}

            new A/*1*/
            // not sure...
            new B/*2*/
            new C/*3*/
        `)

        compareMethodSnippetAgainstMarker(markers, 1, ['a'])
        compareMethodSnippetAgainstMarker(markers, 2, null)
        compareMethodSnippetAgainstMarker(markers, 3, [])
    })

    test('Skip trailing void', () => {
        const [, _, markers] = fileContentsSpecialPositions(/* ts */ `
            new Promise<void>((resolve) => {
                resolve/*1*/
            })
            declare const foo: (a: void, b: boolean, c: void, d: void) => void
            type Bar<T> = (a: T) => void
            declare const bar: Bar<void>
            foo/*2*/
            bar/*3*/
        `)

        compareMethodSnippetAgainstMarker(markers, 1, [])
        compareMethodSnippetAgainstMarker(markers, 2, ['a', 'b'])
        compareMethodSnippetAgainstMarker(markers, 3, [])
    })

    test('Insert text = always-declaration', () => {
        overrideSettings({
            'methodSnippets.insertText': 'always-declaration',
        })
        const [, _, markers] = fileContentsSpecialPositions(/* ts */ `
            declare const baz: {
                (
                    a: string =
                        "super" +
                        "test",
                    b?, {
                        d = false,
                        e: {}
                    } = { },
                    ...c
                ): void
            }
            baz/*1*/
        `)

        compareMethodSnippetAgainstMarker(markers, 1, '(a = "super" + "test", b?, { d = false, e: {} } = {}, ...c)')
    })

    test('methodSnippets.skip', () => {
        overrideSettings({
            'methodSnippets.skip': 'optional-and-rest',
        })
        const [, _, markers] = fileContentsSpecialPositions(/* ts */ `
            declare const baz: {
                (a: string = "test", b?, {
                    d = false,
                    e: {}
                } = {}, ...c): void
            }
            baz/*1*/
            declare const foo: (a, b?) => void
            foo/*2*/
        `)

        compareMethodSnippetAgainstMarker(markers, 1, [''])
        compareMethodSnippetAgainstMarker(markers, 2, ['a'])
        settingsOverride['methodSnippets.skip'] = 'only-rest'
        compareMethodSnippetAgainstMarker(markers, 1, ['a', 'b', '{ d, e: {} }'])
        settingsOverride['methodSnippets.skip'] = 'all'
        compareMethodSnippetAgainstMarker(markers, 2, [''])
        settingsOverride['methodSnippets.skip'] = 'no-skip'
    })

    test('Ambiguous', () => {
        const [, _, markers] = fileContentsSpecialPositions(/* ts */ `
            declare const a: {
                (): void
                [a: string]: 5
            }
            a/*1*/
            Object/*2*/
        `)

        compareMethodSnippetAgainstMarker(markers, 1, 'ambiguous')
        compareMethodSnippetAgainstMarker(markers, 2, 'ambiguous')
    })

    test('methodSnippets.previewSignature all', () => {
        overrideSettings({
            'methodSnippets.previewSignature': 'all',
        })
        fileContentsSpecialPositions(/* ts */ `
            const a = (a, b) => {}
            a/*1*/

            class A {
                test() {
                    test/*2*/
                }
            }

            const b: { a() } = {
                /*3*/
            }
        `)
        assertCompletionInsertText(1, 'a', 'a(${1:a}, ${2:b})')
        assertCompletionInsertText(2, 'test', 'this.test()')
        assertCompletionInsertText(3, 1, 'a() {\n$0\n},')
    })
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

        // https://github.com/microsoft/vscode/issues/119736

        ;<style>/*f*/
            .test {
                /*f*/
                di/*f*/
            }
        </style>
        :<style>/*f*/</style>
            `)
    const numPositionsTextLength = {
        0: -4,
        1: -5,
        2: -5,
    }
    const getEmmetCompletions = pos => {
        const result = handleCommand(entrypoint, pos, 'emmet-completions', languageService, defaultConfigFunc, {}, {})
        return result?.emmetTextOffset
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
    const { completion } = fourslashLikeTester(/*ts*/ `
        const users = []
        users./*0*/
        ;users.filter(Boolean).flatMap/*1*/
        ;[]./*2*/
    `)
    completion([0, 1], {
        includes: {
            insertTexts: ['flatMap((${2:user}) => $3)'],
        },
    })
    completion(2, {
        includes: {
            insertTexts: ['flatMap((${2:item}) => $3)'],
        },
    })
})

test('String template type completions', () => {
    const tester = fourslashLikeTester(/* ts */ `
        const a: \`v\${'b' | 'c'}.\${number}.\${number}\` = '/*1*/';

        const b: {
            [a: \`foo_\${string}\`]: string
        } = {
            'foo_': '/*2*/'
        }

        const c = (p: typeof b) => { }

        c({
            '/*3*/'
        })

        b['/*4*/']
    `)

    tester.completion(1, {
        exact: {
            names: ['vb.|.|', 'vc.|.|'],
        },
    })

    tester.completion([2, 3, 4], {
        exact: {
            names: ['foo_|'],
        },
    })
})

test('Remove Useless Function Props', () => {
    const tester = fourslashLikeTester(/* ts */ `
        const a = () => {}
        a./*1*/
        const b = {
            Symbol: 5,
            prototype: 5,
            caller: 5,
        }
        b./*2*/
    `)
    const badProps = ['Symbol', 'caller', 'prototype']
    tester.completion(1, {
        excludes: badProps,
    })
    tester.completion(2, {
        includes: {
            names: badProps,
        },
    })
})

test('Switch Case Exclude Covered', () => {
    const [, _, numPositions] = fileContentsSpecialPositions(/*ts*/ `
        let test: 'foo' | 'bar'
        switch (test) {
            case 'foo':
                break;
            case '/*|*/':
                break;
            default:
                break;
        }

        enum SomeEnum {
            A,
            B
        }
        let test2: SomeEnum
        switch (test2) {
            case SomeEnum.B:
                break;
            case SomeEnum./*|*/:
                break;
            default:
                break;
        }
    `)
    const completionsByPos = {
        1: ['bar'],
        2: ['A'],
    }
    for (const [i, pos] of Object.entries(numPositions)) {
        const { entryNames } = getCompletionsAtPosition(pos as number) ?? {}
        expect(entryNames).toEqual(completionsByPos[i])
    }
})

test('Case-sensetive completions', () => {
    overrideSettings({
        caseSensitiveCompletions: true,
    })
    const [_positivePositions, _negativePositions, numPositions] = fileContentsSpecialPositions(/* ts */ `
        const a = {
            TestItem: 5,
            testItem: 5,
            '3t': true
            // not sure of these
            // TestItemFoo: 5,
            // TestItemfoo: 5,
        }
        a.t/*0*/
        a['t/*0*/']
    `)
    for (const pos of numPositions) {
        const { entryNames } = getCompletionsAtPosition(pos) ?? {}
        expect(entryNames, pos.toString()).toEqual(['3t', 'testItem'])
    }
    settingsOverride.caseSensitiveCompletions = false
})

test('Fix properties sorting', () => {
    overrideSettings({
        fixSuggestionsSorting: true,
        'jsxAttributeShortcutCompletions.enable': 'disable',
    })
    fourslashLikeTester(/* tsx */ `
        let a: {
            d
            b(a: {c, a}): {c, a}
        } | {
            c
            b(c: {c, b}): {c, b}
        }
        if ('c' in a) {
            a./*1*/;
            a.b({/*2*/})./*3*/
        }

        let a: { b:{}, a() } = {
            /*5*/
        }

        declare function MyComponent(props: { b?; c? } & { a? }): JSX.Element
        <MyComponent /*4*/ />;
        <MyComponent
            c=''
        /*41*/
        />;
        <MyComponent
            test2=''
        /*41*/
        test=''
        />;
        <MyComponent /*42*/
            test2=''
        />;
    `)
    const assertSorted = (marker: number, expected: string[]) => {
        const { entriesSorted } = getCompletionsAtPosition(currentTestingContext.markers[marker]!)!
        expect(
            entriesSorted.map(x => x.name),
            `${marker}`,
        ).toEqual(expected)
    }
    assertSorted(1, ['c', 'b'])
    assertSorted(2, ['c', 'b'])
    assertSorted(3, ['c', 'b'])
    assertSorted(4, ['b', 'c', 'a'])
    assertSorted(41, ['b', 'c', 'a'])
    assertSorted(42, ['b', 'c', 'a'])
    assertSorted(5, ['b', 'b', 'a', 'a'])
    settingsOverride.fixSuggestionsSorting = false
})

const testTs5 = isTs5() ? test : test.todo

testTs5('Change to function kind', () => {
    settingsOverride['experiments.changeKindToFunction'] = true
    overrideSettings({
        'experiments.changeKindToFunction': true,
    })
    const tester = fourslashLikeTester(/* ts */ `
        // declare const foo: boolean
        const foo = () => {}
        foo/*1*/
    `)
    tester.completion(1, {
        includes: {
            names: ['foo'],
            all: {
                kind: ts.ScriptElementKind.functionElement,
            },
        },
    })
    settingsOverride['experiments.changeKindToFunction'] = false
})

testTs5('Filter JSX Components', () => {
    overrideSettings({
        // improveJsxCompletions: false,
        'experiments.excludeNonJsxCompletions': true,
    })
    const tester = fourslashLikeTester(/* tsx */ `
        const someFunction = () => {}
        declare namespace JSX {
            interface IntrinsicElements {
                superSpan: any;
            }
        }
        // return < // TODO
        return <s/*1*/
    `)
    tester.completion(1, {
        excludes: ['someFunction'],
        includes: {
            names: ['superSpan'],
        },
    })
    // https://github.com/zardoy/typescript-vscode-plugins/issues/205
    const tester2 = fourslashLikeTester(/* tsx */ `
        const Img = ({ alt }) => {}
        <Img\n\t/*1*/\n/>
    `)
    tester2.completion(1, {
        includes: {
            names: ['alt'],
        },
    })
})

test('Omit<..., ""> suggestions', () => {
    const tester = fourslashLikeTester(/* ts */ `
      interface A {
          a: string;
          b: number;
      }
      type B = Omit<A, "/*1*/">;
      type B = Omit<A, "a" | "/*2*/">;
    `)
    tester.completion(1, {
        exact: {
            names: ['a', 'b'],
        },
    })
    tester.completion(2, {
        exact: {
            names: ['b'],
        },
    })
})

// Already works out of the box, but the fix can be better
test.skip('Additional types suggestions', () => {
    const tester = fourslashLikeTester(/* ts */ `
      type A<T /*1*/> = T;
      type A<T extends 'a' | 'b' = '/*2*/'> = T;
    `)
    tester.completion(1, {
        exact: {
            names: ['extends'],
        },
    })
    tester.completion(2, {
        exact: {
            names: ['a', 'b'],
        },
    })
})

test('Tuple signature', () => {
    const tester = fourslashLikeTester(/* ts */ `
        const [/*1*/] = [] as [a: number]
    `)
    tester.completion(1, {
        exact: {
            names: ['a'],
        },
    })
})

test('JSX attribute shortcut completions', () => {
    const tester = fourslashLikeTester(/* tsx */ `
        const A = ({a, b}) => {}
        const a = 5
        const c = <A /*1*/ />
        const d = <A a={/*2*/} />
        `)
    tester.completion(1, {
        exact: {
            names: ['a', 'a={a}', 'b'],
        },
    })
    tester.completion(2, {
        excludes: ['a={a}'],
    })
})

test('Object Literal Completions', () => {
    const [_positivePositions, _negativePositions, numPositions] = fileContentsSpecialPositions(/* ts */ `
    interface Options {
        usedOption
        mood?: 'happy' | 'sad'
        callback?()
        additionalOptions?: {
            bar: boolean
            bar2: false
            foo?: boolean
        }
        plugins: Array<{ name: string, setup(build) }>
        undefinedOption: undefined
    }

    const makeDay = (options?: Options) => {}
    makeDay({
        usedOption,
        /*1*/
    })

    const somethingWithUnions: { a: string } | { a: any[], b: string } = {/*2*/}

    makeDay({
        additionalOptions: {
            /*3*/
        }
    })

    const a = {
        /*4*/
    }
    `)
    const { entriesSorted: pos1 } = getCompletionsAtPosition(numPositions[1]!)!
    const { entriesSorted: pos2 } = getCompletionsAtPosition(numPositions[2]!)!
    const { entriesSorted: pos3 } = getCompletionsAtPosition(numPositions[3]!)!
    const { entriesSorted: pos4 } = getCompletionsAtPosition(numPositions[4]!)!
    // todo resolve sorting problem + add tests with other keepOriginal (it was tested manually)
    for (const entry of [...pos1, ...pos2, ...pos3]) {
        entry.insertText = entry.insertText?.replaceAll('\n', '\\n')
    }
    expect(pos1).toMatchInlineSnapshot(/* json */ `
      [
        {
          "insertText": "plugins",
          "isSnippet": true,
          "kind": "property",
          "kindModifiers": "",
          "name": "plugins",
        },
        {
          "insertText": "plugins: [\\\\n	$1\\\\n],",
          "isSnippet": true,
          "kind": "property",
          "kindModifiers": "",
          "labelDetails": {
            "detail": ": [],",
          },
          "name": "plugins",
        },
        {
          "insertText": "undefinedOption",
          "isSnippet": true,
          "kind": "property",
          "kindModifiers": "",
          "name": "undefinedOption",
        },
        {
          "insertText": "additionalOptions",
          "isSnippet": true,
          "kind": "property",
          "kindModifiers": "optional",
          "name": "additionalOptions",
        },
        {
          "insertText": "additionalOptions: {\\\\n	$1\\\\n},",
          "isSnippet": true,
          "kind": "property",
          "kindModifiers": "optional",
          "labelDetails": {
            "detail": ": {},",
          },
          "name": "additionalOptions",
        },
        {
          "insertText": "callback",
          "isSnippet": true,
          "kind": "method",
          "kindModifiers": "optional",
          "name": "callback",
        },
        {
          "insertText": "callback() {\\\\n$0\\\\n},",
          "isSnippet": true,
          "kind": "method",
          "kindModifiers": "optional",
          "labelDetails": {
            "detail": "()",
          },
          "name": "callback",
          "source": "ObjectLiteralMethodSnippet/",
        },
        {
          "insertText": "mood",
          "isSnippet": true,
          "kind": "property",
          "kindModifiers": "optional",
          "name": "mood",
        },
        {
          "insertText": "mood: \\"$1\\",",
          "isSnippet": true,
          "kind": "property",
          "kindModifiers": "optional",
          "labelDetails": {
            "detail": ": \\"\\",",
          },
          "name": "mood",
        },
      ]
    `)
    expect(pos2.map(x => x.insertText)).toMatchInlineSnapshot(`
      [
        "a",
        "b",
        "b: \\"$1\\",",
      ]
    `)
    // I guess vitest hangs forever here
    expect(pos3.map(x => x.insertText)).toMatchInlineSnapshot(`
      [
        "bar",
        "bar: \${1|true,false|},",
        "bar2",
        "bar2: false,",
        "foo",
        "foo: \${1|true,false|},",
      ]
    `)
    expect(pos4.filter(x => x.insertText?.includes(': '))).toEqual([])
})

test('Object Literal Completions with keepOriginal: remove & builtin method snippets', () => {
    overrideSettings({
        'objectLiteralCompletions.keepOriginal': 'remove',
    })
    const { completion } = fourslashLikeTester(/* ts */ `
        interface Options {
            a: {}
            onA()
        }
        const options: Options = {
            /*1*/
        }
    `)
    completion(1, {
        exact: {
            insertTexts: ['a: {\n\t$1\n},', 'onA() {\n$0\n},'],
            all: {
                isSnippet: true,
            },
        },
    })
})

test('Extract to type / interface name inference', () => {
    fourslashLikeTester(/* ts */ `
        const foo: { bar: string; } = { bar: 'baz' }
        const foo = { bar: 'baz' } satisfies { bar: 5 }

        const fn = (foo: { bar: 'baz' }, foo = {} as { bar: 'baz' }) => {}

        const obj = { foo: { bar: 'baz' } as { bar: string; } }
    `)
})

test('In Keyword Completions', () => {
    const [pos] = newFileContents(/* ts */ `
        declare const a: { a: boolean, b: string } | { a: number, c: number } | string
        if ('/*|*/' in a) {}
    `)
    const completion = pickObj(getCompletionsAtPosition(pos!, { shouldHave: true })!, 'entriesSorted', 'prevCompletionsMap')
    // this test is bad case of demonstrating how it can be used with string in union (IT SHOULDNT!)
    // but it is here to ensure this is no previous crash issue, indexes are correct when used only with objects
    expect({
        ...completion,
        prevCompletionsMap: Object.entries(completion.prevCompletionsMap).map(([key, v]) => [key, (v.documentationOverride as string).replaceAll('\n', '  ')]),
    }).toMatchInlineSnapshot(`
      {
        "entriesSorted": [
          {
            "insertText": "a",
            "isSnippet": true,
            "kind": "string",
            "labelDetails": {
              "description": "2, 3",
            },
            "name": "a",
            "replacementSpan": {
              "length": 0,
              "start": 101,
            },
          },
          {
            "insertText": "b",
            "isSnippet": true,
            "kind": "string",
            "labelDetails": {
              "description": "2",
            },
            "name": "☆b",
            "replacementSpan": {
              "length": 0,
              "start": 101,
            },
          },
          {
            "insertText": "c",
            "isSnippet": true,
            "kind": "string",
            "labelDetails": {
              "description": "3",
            },
            "name": "☆c",
            "replacementSpan": {
              "length": 0,
              "start": 101,
            },
          },
        ],
        "prevCompletionsMap": [
          [
            "a",
            "2: boolean    3: number",
          ],
          [
            "☆b",
            "2: string",
          ],
          [
            "☆c",
            "3: number",
          ],
        ],
      }
    `)
})
describe('Typecast completions', () => {
    test('As completions', () => {
        const [pos] = newFileContents(/*ts*/ `
            const b = 5
            const a = b as /*|*/
        `)
        const completions = getCompletionsAtPosition(pos!)?.entriesSorted

        expect(completions?.[0]?.name).toEqual('number')
    })
    test('jsDoc typecast', () => {
        const [pos] = newFileContents(/*ts*/ `
            const b = 5
            const a = /** @type {/*|*/} */(b)
        `)
        const completions = getCompletionsAtPosition(pos!)?.entriesSorted

        expect(completions?.[0]?.name).toEqual('number')
    })
})
