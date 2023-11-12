import { isNumber } from 'lodash'
import {
    findChildContainingExactPosition,
    getChangesTracker,
    getPositionHighlights,
    isValidInitializerForDestructure,
    isNameUniqueAtNodeClosestScope,
} from '../../utils'
import { CodeAction } from '../getCodeActions'

export const getPropertyIdentifier = (bindingElement: ts.BindingElement): ts.Identifier | undefined => {
    const name = bindingElement.propertyName ?? bindingElement.name
    return ts.isIdentifier(name) ? name : undefined
}
const createFlattenedExpressionFromDestructuring = (bindingElement: ts.BindingElement, baseExpression: ts.Expression) => {
    // number: array index; identifier: property name
    const propertyAccessors: Array<ts.Identifier | number> = []
    let current: ts.Node = bindingElement
    while (ts.isBindingElement(current)) {
        propertyAccessors.push(ts.isObjectBindingPattern(current.parent) ? getPropertyIdentifier(current)! : current.parent.elements.indexOf(current))
        current = current.parent.parent
    }

    let flattenedExpression = baseExpression
    for (const [i, _] of propertyAccessors.reverse().entries()) {
        const accessor = propertyAccessors[i]

        flattenedExpression = isNumber(accessor)
            ? ts.factory.createElementAccessExpression(flattenedExpression, ts.factory.createNumericLiteral(accessor))
            : ts.factory.createPropertyAccessExpression(flattenedExpression, accessor!.text)
    }
    return flattenedExpression
}

const collectBindings = (node: ts.BindingPattern): ts.BindingElement[] => {
    const bindings: ts.BindingElement[] = []

    const doCollectBindings = (node: ts.BindingPattern) => {
        for (const element of node.elements) {
            if (ts.isOmittedExpression(element)) {
                continue
            }

            const elementName = element.name

            if (ts.isIdentifier(elementName)) {
                bindings.push(element)
            } else if (ts.isArrayBindingPattern(elementName) || ts.isObjectBindingPattern(elementName)) {
                doCollectBindings(elementName)
            }
        }
    }

    doCollectBindings(node)

    return bindings
}

const convertFromDestructureWithVariableNameReplacement = (
    declarationName: ts.BindingPattern,
    sourceFile: ts.SourceFile,
    languageService: ts.LanguageService,
) => {
    const bindings = collectBindings(declarationName)
    const tracker = getChangesTracker({})

    const BASE_VARIABLE_NAME = 'newVariable'

    const uniqueVariableName = isNameUniqueAtNodeClosestScope(BASE_VARIABLE_NAME, declarationName, languageService.getProgram()!.getTypeChecker())
        ? BASE_VARIABLE_NAME
        : tsFull.getUniqueName(BASE_VARIABLE_NAME, sourceFile as unknown as FullSourceFile)

    const uniqueVariableIdentifier = ts.factory.createIdentifier(uniqueVariableName)

    for (const binding of bindings) {
        const declaration = createFlattenedExpressionFromDestructuring(binding, uniqueVariableIdentifier)

        /** Important to use `getEnd()` here to get correct highlights for destructured and renamed binding, e.g. `{ bar: bar_1 }` */
        const bindingNameEndPos = binding.getEnd()
        const highlightPositions = getPositionHighlights(bindingNameEndPos, sourceFile, languageService)

        if (!highlightPositions) return

        for (const pos of highlightPositions) {
            if (pos >= declarationName.getStart() && pos <= declarationName.getEnd()) {
                continue
            }
            const node = findChildContainingExactPosition(sourceFile, pos)

            if (!node || ts.isPropertyAssignment(node.parent)) continue
            const printer = ts.createPrinter()

            // If dotDotDotToken is present, we work with rest element, so we need to replace it with identifier
            const replacement = binding.dotDotDotToken
                ? uniqueVariableIdentifier
                : ts.isShorthandPropertyAssignment(node.parent)
                ? ts.factory.createPropertyAssignment(node.parent.name, declaration)
                : declaration

            tracker.replaceRangeWithText(sourceFile, { pos, end: node.end }, printer.printNode(ts.EmitHint.Unspecified, replacement, sourceFile))
        }
    }

    const declarationNameLeadingTrivia = declarationName.getLeadingTriviaWidth(sourceFile)

    tracker.replaceRange(sourceFile, { pos: declarationName.pos + declarationNameLeadingTrivia, end: declarationName.end }, uniqueVariableIdentifier)
    const changes = tracker.getChanges()
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
    id: 'fromDestruct',
    name: 'From Destruct',
    kind: 'refactor.rewrite.from-destruct',
    tryToApply(sourceFile, position, _range, node, formatOptions, languageService) {
        if (!node || !position) return
        const declaration = ts.findAncestor(node, n => ts.isVariableDeclaration(n) || ts.isParameter(n)) as
            | ts.VariableDeclaration
            | ts.ParameterDeclaration
            | undefined

        if (!declaration || !(ts.isObjectBindingPattern(declaration.name) || ts.isArrayBindingPattern(declaration.name))) return

        if (ts.isParameter(declaration)) {
            return convertFromDestructureWithVariableNameReplacement(declaration.name, sourceFile, languageService)
        }

        if (!ts.isVariableDeclarationList(declaration.parent)) return

        const { initializer } = declaration
        if (!initializer || !isValidInitializerForDestructure(initializer)) return

        const bindings = collectBindings(declaration.name)
        if (bindings.length > 1) {
            return convertFromDestructureWithVariableNameReplacement(declaration.name, sourceFile, languageService)
        }

        const { factory } = ts

        const declarations = bindings.map(bindingElement =>
            factory.createVariableDeclaration(
                bindingElement.name,
                undefined,
                undefined,
                createFlattenedExpressionFromDestructuring(bindingElement, initializer),
            ),
        )

        const variableDeclarationList = declaration.parent

        const updatedVariableDeclarationList = factory.createVariableDeclarationList(declarations, variableDeclarationList.flags)

        const tracker = getChangesTracker(formatOptions ?? {})

        const leadingTrivia = variableDeclarationList.getLeadingTriviaWidth(sourceFile)

        tracker.replaceRange(sourceFile, { pos: variableDeclarationList.pos + leadingTrivia, end: variableDeclarationList.end }, updatedVariableDeclarationList)

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
    },
} satisfies CodeAction
