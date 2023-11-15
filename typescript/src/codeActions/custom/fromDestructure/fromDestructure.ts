import { getChangesTracker, isValidInitializerForDestructure } from '../../../utils'
import { CodeAction } from '../../getCodeActions'
import createFlattenedExpressionFromDestructuring from './createFlattenedExpressionFromDestructuring'
import fromSplittedDestructure from './fromSplittedDestructure'
import { collectBindings } from './utils'

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
            return fromSplittedDestructure(declaration.name, sourceFile, languageService)
        }

        if (!ts.isVariableDeclarationList(declaration.parent)) return

        const { initializer } = declaration
        if (!initializer || !isValidInitializerForDestructure(initializer)) return

        const bindings = collectBindings(declaration.name)
        if (bindings.length > 1) {
            return fromSplittedDestructure(declaration.name, sourceFile, languageService)
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
