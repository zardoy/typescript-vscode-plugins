import { findChildContainingExactPosition } from '../utils'

export default (languageService: ts.LanguageService, sourceFile: ts.SourceFile, position: number) => {
    let node = findChildContainingExactPosition(sourceFile, position)
    if (!node) return
    node = getNodeForQuickInfo(node)
    const checker = languageService.getProgram()!.getTypeChecker()!
    const symbol = getSymbolAtLocationForQuickInfo(node, checker)
    if (!symbol) return
    const type = checker.getTypeOfSymbol(symbol)
    return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.NoTypeReduction)
}

function getNodeForQuickInfo(node: ts.Node): ts.Node {
    if (ts.isNewExpression(node.parent) && node.pos === node.parent.pos) {
        return node.parent.expression
    }
    if (ts.isNamedTupleMember(node.parent) && node.pos === node.parent.pos) {
        return node.parent
    }
    //@ts-expect-error
    if (tsFull.isImportMeta(node.parent) && node.parent.name === node) {
        return node.parent
    }
    if (ts.isJsxNamespacedName(node.parent)) {
        return node.parent
    }
    return node
}

function getSymbolAtLocationForQuickInfo(node: ts.Node, checker: ts.TypeChecker): ts.Symbol | undefined {
    const object = tsFull.getContainingObjectLiteralElement(node as any) as any
    if (object) {
        const contextualType = checker.getContextualType(object.parent)
        const properties = contextualType && tsFull.getPropertySymbolsFromContextualType(object, checker as any, contextualType as any, /*unionSymbolOk*/ false)
        if (properties && properties.length === 1) {
            return properties[0]! as any
        }
    }
    return checker.getSymbolAtLocation(node)
}
