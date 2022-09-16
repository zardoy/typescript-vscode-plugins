import * as vscode from 'vscode'
import delay from 'delay'
import dedent from 'string-dedent'

import { expect } from 'chai'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
//@ts-ignore
import type { Configuration } from '../../src/configurationType'
import { fromFixtures, replaceEditorText } from './utils'

describe('Outline', () => {
    const content = dedent/* tsx */ `
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
    `

    let document: vscode.TextDocument
    const editor = () => vscode.window.activeTextEditor!

    const getOutline = async () => vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri) as any

    // let editor: vscode.TextEditor
    const startPos = new vscode.Position(0, 0)
    before(async () => {
        const configKey: keyof Configuration = 'patchOutline'
        const configValue: Configuration['patchOutline'] = true
        await vscode.workspace.getConfiguration('tsEssentialPlugins').update(configKey, configValue, vscode.ConfigurationTarget.Global)
        await delay(600)
        await vscode.workspace
            .openTextDocument({
                content,
                language: 'typescriptreact',
            })
            .then(async newDocument => {
                document = newDocument
                /* editor =  */ await vscode.window.showTextDocument(document)
            })
    })

    it('Outline untitled works', async () => {
        console.time('get outline')
        const data = await getOutline()
        console.timeEnd('get outline')
        expect(simplifyOutline(data)).to.deep.equal([
            {
                name: 'A',
                children: [
                    {
                        name: 'Notification.test.another#yes',
                        children: [
                            {
                                name: 'div#ok',
                                children: [
                                    {
                                        name: 'div',
                                    },
                                    {
                                        name: 'span.good',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ])
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
    })

    describe('Outline in js project', () => {
        it('Initial', async () => {
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(fromFixtures('test-project-js')))
            await delay(500)
            await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fromFixtures('test-project-js/src/index.jsx')))
            await delay(600)
            document = editor().document
            const data = await getOutline()
            expect(simplifyOutline(data)).to.deep.equal(jsProjectExpectedOutline())
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor')
        })

        it('Reopen', async () => {
            await delay(500)
            await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(fromFixtures('test-project-js/src/index.jsx')))
            await delay(600)
            document = editor().document
            const data = await getOutline()
            expect(simplifyOutline(data)).to.deep.equal(jsProjectExpectedOutline())
        })

        it('Text change', async () => {
            const searchText = 'NavBar'
            const componentEndPos = document.positionAt(document.getText().indexOf(searchText) + searchText.length)
            await replaceEditorText(editor(), new vscode.Range(componentEndPos.translate(0, -1), componentEndPos), '2')
            await delay(500)
            const data = await getOutline()
            expect(simplifyOutline(data)).to.deep.equal(jsProjectExpectedOutline('NavBa2'))
        })

        it('Text change right after TSServer restart', async () => {
            void vscode.commands.executeCommand('typescript.restartTsServer')
            const searchText = 'NavBa2'
            const componentEndPos = document.positionAt(document.getText().indexOf(searchText) + searchText.length)
            await editor().edit(builder => {
                builder.replace(new vscode.Range(componentEndPos.translate(0, -1), componentEndPos), '3')
            })
            await delay(800)
            const data = await getOutline()
            expect(simplifyOutline(data)).to.deep.equal(jsProjectExpectedOutline('NavBa3'))
        })

        it('Text change right with no syntax server', async () => {
            await vscode.workspace.getConfiguration('typescript').update('tsserver.useSyntaxServer', 'never', vscode.ConfigurationTarget.Global)
            // void vscode.commands.executeCommand('typescript.restartTsServer')
            await delay(500)
            const searchText = 'NavBa3'
            const componentEndPos = document.positionAt(document.getText().indexOf(searchText) + searchText.length)
            await editor().edit(builder => {
                builder.replace(new vscode.Range(componentEndPos.translate(0, -1), componentEndPos), '4')
            })
            await delay(800)
            const data = await getOutline()
            expect(simplifyOutline(data)).to.deep.equal(jsProjectExpectedOutline('NavBa4'))
        })
    })
})

const jsProjectExpectedOutline = (navbarPosName = 'NavBar') => [
    {
        name: 'Component',
        children: [
            {
                name: 'div.main__wrap',
                children: [
                    {
                        name: 'main.container',
                        children: [
                            {
                                name: 'div.card__box',
                                children: [
                                    {
                                        name: navbarPosName,
                                    },
                                    {
                                        name: 'Counters',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    },
]

const simplifyOutline = (items: Array<vscode.SymbolInformation & vscode.DocumentSymbol>) => {
    const newItems: Array<{ name: any; children? }> = []
    for (const { children, name } of items) {
        if (name === 'classes') continue
        newItems.push({ name, ...(children?.length ? { children: simplifyOutline(children as any) } : {}) })
    }

    return newItems
}
