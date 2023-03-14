import { ExtendedCodeAction } from '../getCodeActions'

export default {
    codes: [2339],
    kind: 'quickfix',
    title: 'Declare missing property',
    tryToApply({ sourceFile, node }) {
        if (node && ts.isIdentifier(node) && ts.isObjectBindingPattern(node.parent.parent) && ts.isParameter(node.parent.parent.parent)) {
            const param = node.parent.parent.parent
            // special react pattern
            if (ts.isArrowFunction(param.parent) && ts.isVariableDeclaration(param.parent.parent)) {
                const variableDecl = param.parent.parent
                if (variableDecl.type?.getText().match(/(React\.)?FC/)) {
                    // handle interface
                }
            }
            // general patterns
            if (param.type && ts.isTypeLiteralNode(param.type) && param.type.members) {
                const hasMembers = param.type.members.length !== 0
                const insertPos = param.type.members.at(-1)?.end ?? param.type.end - 1
                const insertComma = hasMembers && sourceFile.getFullText().slice(insertPos - 1, insertPos) !== ','
                let insertText = node.text
                if (insertComma) insertText = `, ${insertText}`
                // alternatively only one snippetEdit could be used with tsFull.escapeSnippetText(insertText) + $0
                return {
                    edits: [
                        {
                            newText: insertText,
                            span: {
                                length: 0,
                                start: insertPos,
                            },
                        },
                    ],
                    snippetEdits: [
                        {
                            newText: '$0',
                            span: {
                                length: 0,
                                start: insertPos + insertText.length - 1,
                            },
                        },
                    ],
                }
            }
        }
        return
    },
} as ExtendedCodeAction
