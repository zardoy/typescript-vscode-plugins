import { CodeFixInterface } from './codeFixInterface'

export default {
    codes: [2339],
    provideFix(diagnostic, startNode, sourceFile, languageService) {
        if (ts.isIdentifier(startNode) && ts.isObjectBindingPattern(startNode.parent.parent) && ts.isParameter(startNode.parent.parent.parent)) {
            const param = startNode.parent.parent.parent
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
                let insertText = startNode.escapedText as string
                if (insertComma) insertText = `, ${insertText}`
                return {
                    description: 'Declare missing property',
                    fixName: 'declareMissingProperty',
                    changes: [
                        {
                            fileName: sourceFile.fileName,
                            textChanges: [
                                {
                                    span: { length: 0, start: insertPos },
                                    newText: insertText,
                                },
                            ],
                        },
                    ],
                }
            }
        }
        return
    },
} as CodeFixInterface
