import ts from 'typescript'
import { findChildContainingExactPosition, matchParents } from './utils'

export const eventDefinitions = (languageService: ts.LanguageService, fileName: string, position: number): ts.DefinitionInfoAndBoundSpan | undefined => {
    const program = languageService.getProgram()!
    const sourceFile = program.getSourceFile(fileName)!
    const node = findChildContainingExactPosition(sourceFile, position)
    if (!node || !ts.isStringLiteral(node)) return
    const eventName = node.text
    const expr = matchParents(node, ['StringLiteral', 'CallExpression'])
    if (!expr) return
    if (!ts.isPropertyAccessExpression(expr.expression)) return
    const parentAccessEndPos = expr.expression.expression.getEnd()
    const method = expr.expression.name.text
    let lookForMethods: string[] | undefined
    const onMethods = ['on', 'once', 'off', 'addEventListener', 'removeEventListener', 'addListener', 'removeListener']
    const triggerMethods = ['trigger', 'emit', 'dispatchEvent']
    if (onMethods.includes(method)) {
        lookForMethods = triggerMethods
    }
    if (triggerMethods.includes(method)) {
        lookForMethods = onMethods
    }
    if (!lookForMethods) return
    const references = languageService.findReferences(fileName, parentAccessEndPos) ?? []
    const defs: ts.DefinitionInfo[] = references
        .flatMap(({ references }) => references)
        .map(({ fileName, textSpan }): ts.DefinitionInfo | undefined => {
            const sourceFile = program.getSourceFile(fileName)!
            const node = findChildContainingExactPosition(sourceFile, textSpan.start)
            if (!node) return
            if (!ts.isPropertyAccessExpression(node.parent)) return
            let upNode = node as ts.PropertyAccessExpression
            while (ts.isPropertyAccessExpression(upNode.parent)) {
                upNode = upNode.parent
            }
            if (!ts.isCallExpression(upNode.parent)) return
            if (!ts.isPropertyAccessExpression(upNode.parent.expression)) return
            const method = upNode.parent.expression.name.text
            if (!lookForMethods!.includes(method)) return
            const arg = upNode.parent.arguments[0]
            if (!arg || !ts.isStringLiteral(arg)) return
            const lastArgEnd = upNode.parent.arguments.at(-1)!.end
            const span = ts.createTextSpanFromBounds(arg.pos, lastArgEnd)
            if (arg.text !== eventName) return

            return {
                kind: ts.ScriptElementKind.memberVariableElement,
                name: method,
                containerKind: ts.ScriptElementKind.variableElement,
                containerName: method,
                textSpan: span,
                fileName,
            }
        })
        .filter(a => a !== undefined)
        .map(a => a!)
    return {
        textSpan: ts.createTextSpanFromBounds(node.pos, node.end),
        definitions: defs,
    }
}
