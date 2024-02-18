import { findChildContainingExactPosition } from '../../../utils'

export const checkAutoInsertDotValue = (sourceFile: ts.SourceFile, position: number, languageService: ts.LanguageService) => {
    const node = findChildContainingExactPosition(sourceFile, position)
    if (!node || isBlacklistNode(sourceFile, position)) return false

    const checker = languageService.getProgram()!.getTypeChecker()
    const type = checker.getTypeAtLocation(node)
    const props = type.getProperties()

    if (props.some(prop => prop.name === 'value')) return true
    return false
}
/**
 * Checks if the given expression needs to be wrapped with `toRefs` to preserve reactivity.
 * @param expression The expression to check.
 * @returns A boolean value indicating whether the expression needs to be wrapped.
 */
export const checkNeedToRefsWrap = (expression: ts.Expression) => {
    const willLoseReactivityIfDestructFns = new Set(['defineProps', 'reactive'])
    return Boolean(ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && willLoseReactivityIfDestructFns.has(expression.expression.text))
}

function isBlacklistNode(node: ts.Node, pos: number) {
    if (ts.isVariableDeclaration(node) && pos >= node.name.getFullStart() && pos <= node.name.getEnd()) {
        return true
    }
    if (ts.isFunctionDeclaration(node) && node.name && pos >= node.name.getFullStart() && pos <= node.name.getEnd()) {
        return true
    }
    if (ts.isParameter(node) && pos >= node.name.getFullStart() && pos <= node.name.getEnd()) {
        return true
    }
    if (ts.isPropertyAssignment(node) && pos >= node.name.getFullStart() && pos <= node.name.getEnd()) {
        return true
    }
    if (ts.isShorthandPropertyAssignment(node)) {
        return true
    }
    if (ts.isImportDeclaration(node)) {
        return true
    }
    if (ts.isLiteralTypeNode(node)) {
        return true
    }
    if (ts.isTypeReferenceNode(node)) {
        return true
    }
    if (ts.isPropertyAccessExpression(node) && node.expression.end === pos && node.name.text === 'value') {
        return true
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && isWatchOrUseFunction(node.expression.text) && isTopLevelArgOrArrayTopLevelItem(node)) {
        return true
    }

    let _isBlacklistNode = false
    node.forEachChild(node => {
        if (_isBlacklistNode) return
        if (pos >= node.getFullStart() && pos <= node.getEnd() && isBlacklistNode(node, pos)) {
            _isBlacklistNode = true
        }
    })
    return _isBlacklistNode

    function isWatchOrUseFunction(fnName: string) {
        return fnName === 'watch' || fnName === 'unref' || fnName === 'triggerRef' || fnName === 'isRef' || fnName.startsWith('use-')
    }
    function isTopLevelArgOrArrayTopLevelItem(node: ts.CallExpression) {
        for (const arg of node.arguments) {
            if (pos >= arg.getFullStart() && pos <= arg.getEnd()) {
                if (ts.isIdentifier(arg)) {
                    return true
                }
                if (ts.isArrayLiteralExpression(arg)) {
                    for (const el of arg.elements) {
                        if (pos >= el.getFullStart() && pos <= el.getEnd()) {
                            return ts.isIdentifier(el)
                        }
                    }
                }
                return false
            }
        }
        return false
    }
}
