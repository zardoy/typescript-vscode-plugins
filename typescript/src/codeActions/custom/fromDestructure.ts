import { cloneDeep, isNumber } from 'lodash'
import { findChildContainingExactPosition, getChangesTracker } from '../../utils'
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

    let flattenedExpression = cloneDeep(baseExpression)
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

const convertFromParameterDestructure = (declarationName: ts.BindingPattern, sourceFile: ts.SourceFile, languageService: ts.LanguageService) => {
    const bindings = collectBindings(declarationName)
    const tracker = getChangesTracker({})

    const VARIABLE_NAME = 'newVariable'

    for (const binding of bindings) {
        const declaration = createFlattenedExpressionFromDestructuring(binding, ts.factory.createIdentifier(VARIABLE_NAME))

        const references = languageService.findReferences(sourceFile.fileName, binding.getStart())
        if (!references) continue
        const referencesPositions = references.flatMap(reference => reference.references.map(({ textSpan: { start } }) => start))

        for (const pos of referencesPositions) {
            if (pos >= declarationName.getStart() && pos <= declarationName.getEnd()) {
                continue
            }
            const node = findChildContainingExactPosition(sourceFile, pos)

            if (!node) continue
            tracker.replaceNode(sourceFile, node, declaration)
        }
    }

    tracker.replaceNode(sourceFile, declarationName, ts.factory.createIdentifier(VARIABLE_NAME))
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
            return convertFromParameterDestructure(declaration.name, sourceFile, languageService)
        }

        if (!ts.isVariableDeclarationList(declaration.parent)) return

        const { initializer } = declaration
        if (!initializer) return

        const bindings = collectBindings(declaration.name)
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

        const updatedVariableDeclarationList = factory.updateVariableDeclarationList(variableDeclarationList, declarations)

        const tracker = getChangesTracker(formatOptions ?? {})
        tracker.replaceNode(sourceFile, variableDeclarationList, updatedVariableDeclarationList, { leadingTriviaOption: 1 })

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
