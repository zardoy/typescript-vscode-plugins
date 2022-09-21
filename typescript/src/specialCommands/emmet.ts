import isGoodPositionForEmmetCompletion from '../completions/isGoodPositionForEmmetCompletion'
import { nodeModules } from '../utils'

export default (fileName: string, node: ts.Node, sourceFile: ts.SourceFile, position: number, languageService: ts.LanguageService /* , c: GetConfig */) => {
    if (__WEB__ || !isGoodPositionForEmmetCompletion(fileName, node, sourceFile, position, languageService)) return []
    const nodeText = node.getFullText().slice(0, position - node.pos)
    const { emmet } = nodeModules!
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
    return emmetCompletions.items
    // for (const completion of emmetCompletions.items)
    //     prior.entries.push({
    //         kind: ts.ScriptElementKind.label,
    //         name: completion.label.slice(1),
    //         sortText: '!5',
    //         // insertText: `${completion.label.slice(1)} ${completion.textEdit?.newText}`,
    //         insertText: completion.textEdit?.newText,
    //         isSnippet: true,
    //         sourceDisplay: completion.detail !== undefined ? [{ kind: 'text', text: completion.detail }] : undefined,
    //         // replacementSpan: { start: position - 5, length: 5 },
    //     })
}
