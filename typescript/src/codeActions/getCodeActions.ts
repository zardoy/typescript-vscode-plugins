import { compact } from '@zardoy/utils'
import { findChildContainingPosition } from '../utils'
import objectSwapKeysAndValues from './objectSwapKeysAndValues'
import toggleBraces from './toggleBraces'

type SimplifiedRefactorInfo = {
    start: number
    length: number
    newText: string
}

export type ApplyCodeAction = (
    sourceFile: ts.SourceFile,
    position: number,
    range: ts.TextRange | undefined,
    node: ts.Node | undefined,
) => ts.RefactorEditInfo | SimplifiedRefactorInfo[] | undefined

export type CodeAction = {
    name: string
    id: string
    tryToApply: ApplyCodeAction
}

const codeActions: CodeAction[] = [/* toggleBraces */ objectSwapKeysAndValues]

export const REFACTORS_CATEGORY = 'essential-refactors'

export default (
    sourceFile: ts.SourceFile,
    positionOrRange: ts.TextRange | number,
    requestingEditsId?: string,
): { info?: ts.ApplicableRefactorInfo; edit: ts.RefactorEditInfo } => {
    const range = typeof positionOrRange !== 'number' && positionOrRange.pos !== positionOrRange.end ? positionOrRange : undefined
    const pos = typeof positionOrRange === 'number' ? positionOrRange : positionOrRange.pos
    const node = findChildContainingPosition(ts, sourceFile, pos)
    const appliableCodeActions = compact(
        codeActions.map(action => {
            const edits = action.tryToApply(sourceFile, pos, range, node)
            if (!edits) return
            return {
                ...action,
                edits: Array.isArray(edits)
                    ? ({
                          edits: [
                              {
                                  fileName: sourceFile.fileName,
                                  textChanges: edits.map(({ length, newText, start }) => {
                                      return {
                                          newText,
                                          span: {
                                              length,
                                              start,
                                          },
                                      }
                                  }),
                              },
                          ],
                      } as ts.RefactorEditInfo)
                    : edits,
            }
        }),
    )

    return {
        info:
            (appliableCodeActions.length && {
                actions: appliableCodeActions.map(({ id, name }) => ({
                    description: name,
                    name: id,
                })),
                // anyway not visible in ui
                description: 'Essential Refactors',
                name: REFACTORS_CATEGORY,
            }) ||
            undefined,
        edit: requestingEditsId ? appliableCodeActions.find(({ id }) => id === requestingEditsId)!.edits : null!,
    }
}
