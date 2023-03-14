import { compact } from '@zardoy/utils'
import { isTypeNode } from './completions/keywordsSpace'
import { GetConfig } from './types'
import { findChildContainingExactPosition } from './utils'

export default (languageService: ts.LanguageService, sourceFile: ts.SourceFile, position: number, c: GetConfig) => {
    const node = findChildContainingExactPosition(sourceFile, position)
    if (!node || isTypeNode(node)) return

    const typeChecker = languageService.getProgram()!.getTypeChecker()!
    const type = typeChecker.getTypeAtLocation(node)
    const signatures = typeChecker.getSignaturesOfType(type, ts.SignatureKind.Call)
    if (signatures.length === 0) return
    const signature = signatures[0]
    if (signatures.length > 1 && c('methodSnippets.multipleSignatures') === 'empty') {
        return ['']
    }
    if (!signature) return

    const insertMode = c('methodSnippets.insertText')
    const skipMode = c('methodSnippets.skip')

    // Investigate merging signatures
    const { parameters } = signatures[0]!
    const printer = ts.createPrinter()
    const paramsToInsert = compact(
        (skipMode === 'all' ? [] : parameters).map(param => {
            const valueDeclaration = param.valueDeclaration as ts.ParameterDeclaration | undefined
            const isOptional =
                valueDeclaration && (valueDeclaration.questionToken || valueDeclaration.initializer || valueDeclaration.dotDotDotToken) ? true : false
            switch (skipMode) {
                case 'only-rest':
                    if (valueDeclaration?.dotDotDotToken) return undefined
                    break
                case 'optional-and-rest':
                    if (isOptional) return undefined
                    break
            }
            const insertName = insertMode === 'always-name' || !valueDeclaration
            const insertText = insertName
                ? param.name
                : printer.printNode(
                      ts.EmitHint.Unspecified,
                      ts.factory.createParameterDeclaration(
                          undefined,
                          valueDeclaration.dotDotDotToken,
                          insertMode === 'always-declaration' ? valueDeclaration.name : cloneBindingName(valueDeclaration.name),
                          insertMode === 'always-declaration' ? valueDeclaration.questionToken : undefined,
                          undefined,
                          insertMode === 'always-declaration' && valueDeclaration.initializer
                              ? ts.setEmitFlags(
                                    tsFull.factory.cloneNode(valueDeclaration.initializer as any),
                                    ts.EmitFlags.SingleLine | ts.EmitFlags.NoAsciiEscaping,
                                )
                              : undefined,
                      ),
                      valueDeclaration.getSourceFile(),
                  )
            return insertText
        }),
    )

    const allFiltered = paramsToInsert.length === 0 && parameters.length > paramsToInsert.length
    if (allFiltered) return ['']

    // methodSnippets.replaceArguments is processed with last stage in onCompletionAccepted
    return paramsToInsert
    // return `(${paramsToInsert.map((param, i) => `\${${i + 1}:${param.replaceAll}}`).join(', ')})`

    function cloneBindingName(node: ts.BindingName): ts.BindingName {
        if (ts.isIdentifier(node)) return ts.factory.createIdentifier(node.text)
        return elideInitializerAndSetEmitFlags(node) as ts.BindingName
        function elideInitializerAndSetEmitFlags(node: ts.Node): ts.Node {
            let visited = ts.visitEachChild(
                node,
                elideInitializerAndSetEmitFlags,
                tsFull.nullTransformationContext as any,
                /*nodesVisitor*/ undefined,
                elideInitializerAndSetEmitFlags,
            )!
            if (ts.isBindingElement(visited)) {
                visited = ts.factory.updateBindingElement(visited, visited.dotDotDotToken, visited.propertyName, visited.name, /*initializer*/ undefined)
            }
            // if (!tsFull.nodeIsSynthesized(visited)) {
            //     visited = ts.factory.cloneNode(visited);
            // }
            return ts.setEmitFlags(visited, ts.EmitFlags.SingleLine | ts.EmitFlags.NoAsciiEscaping)
        }
    }
}
