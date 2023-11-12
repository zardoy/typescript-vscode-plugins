import { findChildContainingExactPosition, getChangesTracker, getPositionHighlights, isValidInitializerForDestructure, makeUniqueName } from '../../utils'
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
    const isObjectVariableDecl = ts.isVariableDeclaration(node.parent) && node.parent.initializer && ts.isObjectLiteralExpression(node.parent.initializer)

    // Make sure it only triggers on the destructuring object or parameter
    if (!ts.isIdentifier(node) || !(isObjectVariableDecl || ts.isParameter(node.parent))) return

    const highlightPositions = getPositionHighlights(node.getStart(), sourceFile, languageService)

    if (!highlightPositions) return
    const tracker = getChangesTracker(formatOptions ?? {})

    const propertyNames: Array<{ initial: string; unique: string | undefined; dotDotDotToken?: ts.DotDotDotToken }> = []
    let nodeToReplaceWithBindingPattern: ts.Identifier | undefined

    for (const pos of highlightPositions) {
        const highlightedNode = findChildContainingExactPosition(sourceFile, pos)

        if (!highlightedNode) continue

        if (
            ts.isIdentifier(highlightedNode) &&
            (ts.isPropertyAccessExpression(highlightedNode.parent) || ts.isElementAccessExpression(highlightedNode.parent))
        ) {
            if (ts.isElementAccessExpression(highlightedNode.parent) && ts.isIdentifier(highlightedNode.parent.argumentExpression)) {
                const uniqueName = makeUniqueName('newVariable', node, languageService, sourceFile)

                propertyNames.push({
                    initial: 'newVariable',
                    unique: uniqueName === 'newVariable' ? undefined : uniqueName,
                    dotDotDotToken: ts.factory.createToken(ts.SyntaxKind.DotDotDotToken),
                })

                tracker.replaceRangeWithText(sourceFile, { pos, end: highlightedNode.end }, uniqueName)

                continue
            }
            const indexedAccessorName =
                ts.isElementAccessExpression(highlightedNode.parent) && ts.isStringLiteral(highlightedNode.parent.argumentExpression)
                    ? highlightedNode.parent.argumentExpression.text
                    : undefined

            const accessorName = ts.isPropertyAccessExpression(highlightedNode.parent) ? highlightedNode.parent.name.getText() : indexedAccessorName

            if (!accessorName) continue

            const uniqueName = makeUniqueName(accessorName, node, languageService, sourceFile)

            propertyNames.push({ initial: accessorName, unique: uniqueName === accessorName ? undefined : uniqueName })

            tracker.replaceRangeWithText(sourceFile, { pos, end: highlightedNode.parent.end }, uniqueName)
            continue
        }

        if (ts.isIdentifier(highlightedNode) && (ts.isVariableDeclaration(highlightedNode.parent) || ts.isParameter(highlightedNode.parent))) {
            nodeToReplaceWithBindingPattern = highlightedNode
            continue
        }
    }

    if (!nodeToReplaceWithBindingPattern || propertyNames.length === 0) return

    const bindings = propertyNames.map(({ initial, unique, dotDotDotToken }) => {
        return ts.factory.createBindingElement(dotDotDotToken, unique ? initial : undefined, unique ?? initial)
    })
    const withoutDotDotDotToken = bindings.filter(binding => !binding.dotDotDotToken)
    const withDotDotDotToken = bindings.find(binding => binding.dotDotDotToken)

    const bindingsWithRestLast = withDotDotDotToken ? [...withoutDotDotDotToken, withDotDotDotToken] : withoutDotDotDotToken

    const bindingPattern = ts.factory.createObjectBindingPattern(bindingsWithRestLast)
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
