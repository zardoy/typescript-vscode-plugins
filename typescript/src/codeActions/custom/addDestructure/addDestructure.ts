import { getChangesTracker, isValidInitializerForDestructure } from '../../../utils'
import { CodeAction } from '../../getCodeActions'
import createDestructuredDeclaration from './createDestructuredDeclaration'
import addSplittedDestructure from './addSplittedDestructure'

export default {
    id: 'addDestruct',
    name: 'Add Destruct',
    kind: 'refactor.rewrite.add-destruct',
    tryToApply(sourceFile, position, _range, node, formatOptions, languageService) {
        if (!node || !position) return
        const initialDeclaration = ts.findAncestor(node, n => ts.isVariableDeclaration(n)) as ts.VariableDeclaration | undefined

        if (initialDeclaration && !ts.isObjectBindingPattern(initialDeclaration.name)) {
            const { initializer, type, name } = initialDeclaration

            const result = addSplittedDestructure(node, sourceFile, formatOptions, languageService)

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
        return addSplittedDestructure(node, sourceFile, formatOptions, languageService)
    },
} satisfies CodeAction
