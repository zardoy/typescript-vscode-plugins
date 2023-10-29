import {
    findChildContainingExactPosition,
    findClosestParent,
    getChangesTracker,
    isNameUniqueAtLocation,
    getNodeHighlightPositions,
    isValidInitializerForDestructure,
} from '../../utils'
import { CodeAction } from '../getCodeActions'

const createDestructuredDeclaration = (initializer: ts.Expression, type: ts.TypeNode | undefined, declarationName: ts.BindingName) => {
    if (!ts.isPropertyAccessExpression(initializer)) return

    const propertyName = initializer.name.text
    const { factory } = ts

    const bindingElement = factory.createBindingElement(
        undefined,
        declarationName.getText() === propertyName ? undefined : propertyName,
        declarationName.getText(),
    )

    return factory.createVariableDeclaration(
        factory.createObjectBindingPattern([bindingElement]),
        undefined,
        type ? factory.createTypeLiteralNode([factory.createPropertySignature(undefined, factory.createIdentifier(propertyName), undefined, type)]) : undefined,
        initializer.expression,
    )
}
const addDestructureToVariableWithSplittedPropertyAccessors = (
    node: ts.Node,
    sourceFile: ts.SourceFile,
    formatOptions: ts.FormatCodeSettings | undefined,
    languageService: ts.LanguageService,
) => {
    if (!ts.isIdentifier(node) && !(ts.isPropertyAccessExpression(node.parent) || ts.isParameter(node.parent))) return

    const highlightPositions = getNodeHighlightPositions(node, sourceFile, languageService)

    if (!highlightPositions) return
    const tracker = getChangesTracker(formatOptions ?? {})

    const propertyNames: Array<{ initial: string; unique: string | undefined }> = []
    let nodeToReplaceWithBindingPattern: ts.Identifier | undefined
    const closestScope = findClosestParent(
        node,
        [ts.SyntaxKind.Block, ts.SyntaxKind.FunctionDeclaration, ts.SyntaxKind.FunctionExpression, ts.SyntaxKind.ArrowFunction],
        [],
    )

    for (const pos of highlightPositions) {
        const highlightedNode = findChildContainingExactPosition(sourceFile, pos)

        if (!highlightedNode) continue

        if (ts.isIdentifier(highlightedNode) && ts.isPropertyAccessExpression(highlightedNode.parent)) {
            const propertyAccessorName = highlightedNode.parent.name.getText()
            const hasNameInScope = isNameUniqueAtLocation(propertyAccessorName, closestScope, languageService.getProgram()!.getTypeChecker())

            const uniquePropertyName = hasNameInScope ? tsFull.getUniqueName(propertyAccessorName, sourceFile as any) : undefined

            propertyNames.push({ initial: propertyAccessorName, unique: uniquePropertyName })

            tracker.replaceRangeWithText(sourceFile, { pos, end: highlightedNode.parent.end }, uniquePropertyName ?? propertyAccessorName)
            continue
        }

        if (ts.isIdentifier(highlightedNode) && (ts.isVariableDeclaration(highlightedNode.parent) || ts.isParameter(highlightedNode.parent))) {
            nodeToReplaceWithBindingPattern = highlightedNode
            continue
        }
    }

    if (!nodeToReplaceWithBindingPattern || propertyNames.length === 0) return

    const bindings = propertyNames.map(({ initial, unique }) => {
        return ts.factory.createBindingElement(undefined, unique ? initial : undefined, unique ?? initial)
    })
    const bindingPattern = ts.factory.createObjectBindingPattern(bindings)
    const { pos, end } = nodeToReplaceWithBindingPattern

    tracker.replaceRange(
        sourceFile,
        {
            pos: pos + nodeToReplaceWithBindingPattern.getLeadingTriviaWidth(),
            end,
        },
        bindingPattern,
    )

    const changes = tracker.getChanges()
    if (!changes) return undefined
    return {
        edits: [
            {
                fileName: sourceFile.fileName,
                textChanges: changes[0]!.textChanges,
            },
        ],
    }
}
export default {
    id: 'addDestruct',
    name: 'Add Destruct',
    kind: 'refactor.rewrite.add-destruct',
    tryToApply(sourceFile, position, _range, node, formatOptions, languageService) {
        if (!node || !position) return
        const initialDeclaration = ts.findAncestor(node, n => ts.isVariableDeclaration(n)) as ts.VariableDeclaration | undefined

        if (initialDeclaration && !ts.isObjectBindingPattern(initialDeclaration.name)) {
            const { initializer, type, name } = initialDeclaration

            const result = addDestructureToVariableWithSplittedPropertyAccessors(node, sourceFile, formatOptions, languageService)

            if (result) return result

            if (!initializer || !isValidInitializerForDestructure(initializer)) return

            const tracker = getChangesTracker(formatOptions ?? {})
            const createdDeclaration = createDestructuredDeclaration(initializer, type, name)
            if (createdDeclaration) {
                tracker.replaceRange(
                    sourceFile,
                    {
                        pos: initialDeclaration.pos + initialDeclaration.getLeadingTriviaWidth(),
                        end: initialDeclaration.end,
                    },
                    createdDeclaration,
                )

                const changes = tracker.getChanges()
                if (!changes) return undefined
                return {
                    edits: [
                        {
                            fileName: sourceFile.fileName,
                            textChanges: changes[0]!.textChanges,
                        },
                    ],
                }
            }
        }
        return addDestructureToVariableWithSplittedPropertyAccessors(node, sourceFile, formatOptions, languageService)
    },
} satisfies CodeAction
