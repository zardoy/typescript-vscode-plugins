import { matchParents } from '../../utils'
import { ExtendedCodeAction } from '../getCodeActions'

export default {
    codes: [2339],
    kind: 'quickfix',
    title: 'Declare missing property',
    tryToApply({ sourceFile, node, c, languageService }) {
        const param = matchParents(node, ['Identifier', 'BindingElement', 'ObjectBindingPattern', 'Parameter'])
        const objAccess = matchParents(node, ['Identifier', 'PropertyAccessExpression'])
        const missingPropName = (node as ts.Identifier).text
        if (objAccess) {
            const checker = languageService.getProgram()!.getTypeChecker()!
            const type = checker.getContextualType(objAccess.expression) || checker.getTypeAtLocation(objAccess.expression)
            const props = type
                .getProperties()
                .map(type => {
                    const node = type.declarations?.find(declaration => {
                        return c('declareMissingPropertyQuickfixOtherFiles') || declaration.getSourceFile().fileName === sourceFile.fileName
                    })
                    if (node === undefined) return undefined!
                    return { name: type.name, node }
                })
                .filter(Boolean)
            // TARGET PROP
            const propInsertAfter = props.find(prop => missingPropName.startsWith(prop.name)) ?? props.at(-1)
            if (propInsertAfter) {
                const propInsertParent = propInsertAfter.node.parent
                const sameParentLiteralProps = props.filter(
                    prop => prop.node.parent === propInsertParent && ts.isPropertyAssignment(prop.node) && !ts.isIdentifier(prop.node.initializer),
                )
                const insertObject =
                    sameParentLiteralProps.length > 0 &&
                    sameParentLiteralProps.every(sameParentProp => ts.isObjectLiteralExpression((sameParentProp.node as ts.PropertyAssignment).initializer))
                const insertPos = propInsertAfter.node.end
                const insertComma = sourceFile.getFullText().slice(insertPos - 1, insertPos) !== ','
                const getLine = pos => sourceFile.getLineAndCharacterOfPosition(pos).line
                const insertNewLine = getLine(propInsertAfter.node.pos) !== getLine(propInsertAfter.node.end)
                const insertText = `${insertComma ? ',' : ''}${insertNewLine ? '\n' : ' '}${missingPropName}`
                const snippet = insertObject ? `: {${insertNewLine ? '\n\t' : ''}$0${insertNewLine ? '\n' : ''}}` : `$0`
                return {
                    snippetEdits: [
                        {
                            newText: `${tsFull.escapeSnippetText(insertText)}${snippet}`,
                            span: {
                                length: 0,
                                start: insertPos,
                            },
                        },
                    ],
                }
            }
        }
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
                let insertText = missingPropName
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
