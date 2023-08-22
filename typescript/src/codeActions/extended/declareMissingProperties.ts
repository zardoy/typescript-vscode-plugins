import { matchParents } from '../../utils'
import { ExtendedCodeAction } from '../getCodeActions'

export default {
    codes: [2339],
    kind: 'quickfix',
    title: 'Declare missing property',
    tryToApply({ sourceFile, node }) {
        const param = matchParents(node, ['Identifier', 'BindingElement', 'ObjectBindingPattern', 'Parameter'])
        if (param) {
            // special react pattern
            if (ts.isArrowFunction(param.parent) && ts.isVariableDeclaration(param.parent.parent)) {
                const variableDecl = param.parent.parent
                if (variableDecl.type?.getText().match(/(React\.)?FC/)) {
                    // todo handle interface
                }
            }
            // general patterns
            if (param.type && ts.isTypeLiteralNode(param.type) && param.type.members) {
                const hasMembers = param.type.members.length > 0
                const insertPos = param.type.members.at(-1)?.end ?? param.type.end - 1
                const insertComma = hasMembers && sourceFile.getFullText().slice(insertPos - 1, insertPos) !== ','
                let insertText = (node as ts.Identifier).text
                if (insertComma) insertText = `, ${insertText}`
                // alternatively only one snippetEdit could be used with tsFull.escapeSnippetText(insertText) + $0
                return {
                    snippetEdits: [
                        {
                            newText: `${tsFull.escapeSnippetText(insertText)}$0`,
                            span: {
                                length: 0,
                                start: insertPos,
                            },
                        },
                    ],
                }
            }
        }
        return
    },
} as ExtendedCodeAction

const testCode = () => {
    const tester = (code: string) => {
        // ^ - problem location in which quickfix needs to be tested (applied)
        // | - cursor position after quickfix is applied
        // [[...]] - applied part of the code
        /* TODO */
    }

    tester(/* ts */ `
        const b = ({ b, ^a }: { b[[, a/*|*/]] }) => {}
    `)
}
