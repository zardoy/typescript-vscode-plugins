import { compact, oneOf } from '@zardoy/utils'
import { isTypeNode } from './completions/keywordsSpace'
import { GetConfig } from './types'
import { findChildContainingExactPosition } from './utils'

// todo-low-ee inspect any last arg infer
export default (
    languageService: ts.LanguageService,
    sourceFile: ts.SourceFile,
    position: number,
    symbol: ts.Symbol | /*for easier testing*/ undefined,
    c: GetConfig,
    // acceptAmbiguous: boolean,
    resolveData: {
        isAmbiguous: boolean
    },
) => {
    let containerNode = findChildContainingExactPosition(sourceFile, position)
    if (!containerNode || isTypeNode(containerNode)) return

    const checker = languageService.getProgram()!.getTypeChecker()!
    let type = symbol ? checker.getTypeOfSymbol(symbol) : checker.getTypeAtLocation(containerNode)
    // give another chance
    if (symbol && type['intrinsicName'] === 'error') type = checker.getTypeOfSymbolAtLocation(symbol, containerNode)

    if (ts.isIdentifier(containerNode)) containerNode = containerNode.parent
    if (ts.isPropertyAccessExpression(containerNode)) containerNode = containerNode.parent

    const isNewExpression = ts.isNewExpression(containerNode)
    if (!isNewExpression && (type.getProperties().length > 0 || type.getStringIndexType() || type.getNumberIndexType())) {
        resolveData.isAmbiguous = true
    }

    const signatures = checker.getSignaturesOfType(type, isNewExpression ? ts.SignatureKind.Construct : ts.SignatureKind.Call)
    // ensure node is not used below
    if (signatures.length === 0) return
    const signature = signatures[0]!
    // probably need to remove check as class can be instantiated inside another class, and don't really see a reason for this check
    if (isNewExpression && hasPrivateOrProtectedModifier((signature.getDeclaration() as ts.ConstructorDeclaration).modifiers)) return
    if (signatures.length > 1 && c('methodSnippets.multipleSignatures') === 'empty') {
        return ['']
    }
    if (!signature) return

    const insertMode = c('methodSnippets.insertText')
    const skipMode = c('methodSnippets.skip')

    // Investigate merging signatures
    const { parameters } = signatures[0]!
    const printer = ts.createPrinter()
    let isVoidOrNotMap: boolean[] = []
    const paramsToInsert = compact(
        (skipMode === 'all' ? [] : parameters).map(param => {
            const valueDeclaration = param.valueDeclaration as ts.ParameterDeclaration | undefined
            const isOptional = !!(valueDeclaration && (valueDeclaration.questionToken || valueDeclaration.initializer || valueDeclaration.dotDotDotToken))
            switch (skipMode) {
                case 'only-rest':
                    if (valueDeclaration?.dotDotDotToken) return undefined
                    break
                case 'optional-and-rest':
                    if (isOptional) return undefined
                    break
                case 'all':
                case 'no-skip':
            }
            const voidType = (checker as unknown as FullChecker).getVoidType() as any
            const parameterType = valueDeclaration && checker.getTypeOfSymbolAtLocation(param, valueDeclaration)
            isVoidOrNotMap.push(
                !!(
                    parameterType &&
                    (parameterType === voidType ||
                        // new Promise<void> resolve type
                        (parameterType.isUnion() &&
                            parameterType.types[0] === voidType &&
                            getPromiseLikeTypeArgument(parameterType.types[1], checker) === voidType))
                ),
            )
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

    const lastNonVoidIndex = isVoidOrNotMap.lastIndexOf(false)
    if (lastNonVoidIndex !== -1) {
        isVoidOrNotMap = [...repeatItems(false, lastNonVoidIndex + 1), .../* true */ isVoidOrNotMap.slice(lastNonVoidIndex + 1)]
    }

    // methodSnippets.replaceArguments is processed with last stage in onCompletionAccepted

    // do natural, final filtering
    return paramsToInsert.filter((_x, i) => !isVoidOrNotMap[i])
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

    function repeatItems<T>(item: T, count: number): T[] {
        return Array.from({ length: count }).map(() => item)
    }
}

function getPromiseLikeTypeArgument(type: ts.Type | undefined, checker: ts.TypeChecker) {
    if (!type) return
    if (!(type.flags & ts.TypeFlags.Object) || !((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference)) return
    if (type.symbol.name !== 'PromiseLike') return
    const typeArgs = checker.getTypeArguments(type as ts.TypeReference)
    if (typeArgs.length !== 1) return
    return typeArgs[0]!
}

function hasPrivateOrProtectedModifier(modifiers: ts.NodeArray<ts.ModifierLike> | ts.NodeArray<ts.Modifier> | undefined) {
    return modifiers?.some(modifier => oneOf(modifier.kind, ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword))
}
