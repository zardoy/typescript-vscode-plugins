import { findChildContainingExactPosition, getChangesTracker, getPositionHighlights, isNameUniqueAtNodeClosestScope } from '../../../utils'
import createFlattenedExpressionFromDestructuring from './createFlattenedExpressionFromDestructuring'
import { collectBindings } from './utils'

export default (declarationName: ts.BindingPattern, sourceFile: ts.SourceFile, languageService: ts.LanguageService) => {
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
