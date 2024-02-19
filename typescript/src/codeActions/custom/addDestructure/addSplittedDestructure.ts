import { uniqBy } from 'lodash'
import { getChangesTracker, getPositionHighlights, isValidInitializerForDestructure } from '../../../utils'
import isVueFileName from '../../../utils/vue/isVueFileName'
import { checkNeedToRefsWrap } from './vueSupportUtils'
import { getDestructureReplaceInfo } from './getDestructureReplaceInfo'

export default (node: ts.Node, sourceFile: ts.SourceFile, formatOptions: ts.FormatCodeSettings | undefined, languageService: ts.LanguageService) => {
    const isValidInitializer = ts.isVariableDeclaration(node.parent) && node.parent.initializer && isValidInitializerForDestructure(node.parent.initializer)

    // Make sure it only triggers on the destructuring object or parameter
    if (!ts.isIdentifier(node) || !(isValidInitializer || ts.isParameter(node.parent))) return

    const highlightPositions = getPositionHighlights(node.getStart(), sourceFile, languageService)

    if (!highlightPositions) return
    const tracker = getChangesTracker(formatOptions ?? {})

    const res = getDestructureReplaceInfo(highlightPositions, node, sourceFile, languageService)

    if (!res) return

    const { propertiesToReplace, nodeToReplaceWithBindingPattern } = res

    if (!nodeToReplaceWithBindingPattern || propertiesToReplace.length === 0) return

    const shouldHandleVueReactivityLose =
        isVueFileName(sourceFile.fileName) &&
        ts.isVariableDeclaration(nodeToReplaceWithBindingPattern.parent) &&
        nodeToReplaceWithBindingPattern.parent.initializer &&
        checkNeedToRefsWrap(nodeToReplaceWithBindingPattern.parent.initializer)

    for (const { initial, range, unique } of propertiesToReplace) {
        const uniqueNameIdentifier = ts.factory.createIdentifier(unique || initial)

        if (shouldHandleVueReactivityLose) {
            const propertyAccessExpression = ts.factory.createPropertyAccessExpression(uniqueNameIdentifier, 'value')
            tracker.replaceRange(sourceFile, range, propertyAccessExpression)
            continue
        }
        tracker.replaceRange(sourceFile, range, uniqueNameIdentifier)
    }

    const bindings = uniqBy(propertiesToReplace, 'unique').map(({ initial, unique }) => {
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

    if (shouldHandleVueReactivityLose) {
        // Wrap the `defineProps` with `toRefs`
        const toRefs = ts.factory.createIdentifier('toRefs')
        const unwrappedCall = nodeToReplaceWithBindingPattern.parent.initializer
        const wrappedWithToRefsCall = ts.factory.createCallExpression(toRefs, undefined, [unwrappedCall])

        tracker.replaceRange(
            sourceFile,
            {
                pos: unwrappedCall.pos,
                end: unwrappedCall.end,
            },
            wrappedWithToRefsCall,
        )
    }

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
