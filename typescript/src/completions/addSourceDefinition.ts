import stringDedent from 'string-dedent'
import { sharedCompletionContext } from './sharedContext'

export default (entries: ts.CompletionEntry[]) => {
    const { prevCompletionsMap, c } = sharedCompletionContext
    if (!c('displayAdditionalInfoInCompletions')) return
    for (const entry of entries) {
        const symbol = entry['symbol'] as ts.Symbol | undefined
        if (!symbol) continue
        const addNodeText = (node: ts.Node) => {
            let text = node.getText().trim()
            if (ts.isBlock(node)) text = text.slice(1, -1)
            try {
                text = stringDedent(text)
            } catch (e) {
                // ignore
            }
            prevCompletionsMap[entry.name] = {
                documentationAppend: `\nFunction source:\n\`\`\`ts\n${text}\n\`\`\`\n`,
            }
        }
        let node: ts.Node = symbol.valueDeclaration!
        if (!node) continue
        if (ts.isVariableDeclaration(node)) node = node.initializer!
        if (!node) continue
        if ((ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) && node.body) {
            const { body } = node
            if (ts.isBlock(body) && body.statements.length === 1 && ts.isReturnStatement(body.statements[0]!)) {
                addNodeText(body.statements[0])
            } else {
                addNodeText(body)
            }
        }
    }
}
