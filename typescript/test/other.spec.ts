import decorateFormatFeatures from '../src/decorateFormatFeatures'
import { defaultConfigFunc, entrypoint, sharedLanguageService } from './shared'
import { getNavTreeItems } from '../src/getPatchedNavTree'
import { createRequire } from 'module'

const { languageService, languageServiceHost, updateProject, getCurrentFile } = sharedLanguageService

test('Format ignore', () => {
    decorateFormatFeatures(languageService, { ...languageService }, languageServiceHost, defaultConfigFunc)
    const contents = /* ts */ `
const a = {
    //@ts-format-ignore-region
    a:   1,
    a1:  2,
    // @ts-format-ignore-endregion
    b:  3,
    // @ts-format-ignore-line Any content don't care
    c:  4,
};`
    updateProject(contents)
    const edits = languageService.getFormattingEditsForRange(entrypoint, 0, contents.length, ts.getDefaultFormatCodeSettings())
    // const sourceFile = languageService.getProgram()!.getSourceFile(entrypoint)!
    // const text = sourceFile.getFullText()
    // edits.forEach(edit => {
    //     console.log(text.slice(0, edit.span.start) + '<<<' + edit.newText + '>>>' + text.slice(edit.span.start + edit.span.length))
    // })
    expect(edits).toMatchInlineSnapshot(/* json */ `
      [
        {
          "newText": " ",
          "span": {
            "length": 2,
            "start": 109,
          },
        },
      ]
    `)
})

const require = createRequire(import.meta.url)

test('Patched navtree (outline)', () => {
    globalThis.__TS_SEVER_PATH__ = require.resolve('typescript/lib/tsserver')
    updateProject(/* tsx */ `
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
    const navTreeItems: ts.NavigationTree = getNavTreeItems({ languageService, languageServiceHost: {} } as any, entrypoint, {
        arraysTuplesNumberedItems: false,
    })
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
