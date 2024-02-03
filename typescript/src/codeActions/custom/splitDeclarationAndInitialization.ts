import { getChangesTracker, getIndentFromPos } from '../../utils'
import { CodeAction } from '../getCodeActions'

export default {
    name: 'Split Declaration and Initialization',
    id: 'splitDeclarationAndInitialization',
    kind: 'refactor.rewrite.split-declaration-and-initialization',
    tryToApply(sourceFile, position, range, node, formatOptions, languageService) {
        if (range || !node) return
        if (!ts.isVariableDeclarationList(node) || node.declarations.length !== 1) return
        const declaration = node.declarations[0]!
        if (position > declaration.pos || !declaration.initializer || !ts.isIdentifier(declaration.name)) return
        if (!formatOptions) return true
        const typeChecker = languageService.getProgram()!.getTypeChecker()!
        let typeNode = declaration.type
        if (!typeNode) {
            let type = typeChecker.getTypeAtLocation(declaration)
            if (type.isLiteral()) {
                type = typeChecker.getBaseTypeOfLiteralType(type)
            }
            typeNode = typeChecker.typeToTypeNode(type, node.parent, ts.NodeBuilderFlags.NoTruncation)
        }
        const changesTracker = getChangesTracker(formatOptions)
        const { factory } = ts
        const nodeStart = node.pos + node.getLeadingTriviaWidth()
        const varName = declaration.name.text
        const isJs = !!(node.flags & ts.NodeFlags.JavaScriptFile)
        const variableDeclaration = factory.createVariableDeclaration(factory.createIdentifier(varName), undefined, isJs ? undefined : typeNode)
        changesTracker.insertNodeAt(sourceFile, nodeStart, factory.createVariableDeclarationList([variableDeclaration], ts.NodeFlags.Let))
        if (isJs && typeNode) {
            const typeTag = factory.createJSDocTypeTag(/*tagName*/ undefined, factory.createJSDocTypeExpression(typeNode), /*comment*/ undefined)
            changesTracker.addJSDocTags(sourceFile, node, [typeTag as any])
        }
        changesTracker.replaceNode(
            sourceFile,
            node,
            factory.createBinaryExpression(factory.createIdentifier(varName), factory.createToken(ts.SyntaxKind.EqualsToken), declaration.initializer),
            {
                prefix: `\n${getIndentFromPos(ts, sourceFile, position)}`,
                suffix: '\n',
                leadingTriviaOption: /*Ignore all*/ 0,
            },
        )
        return changesTracker.getChanges()[0]?.textChanges as ts.TextChange[]
    },
} satisfies CodeAction
