import { compact } from '@zardoy/utils'
import type tslib from 'typescript/lib/tsserverlibrary'
import toggleBraces from './toggleBraces'

type SimplifiedRefactorInfo = {
    start: number
    length: number
    newText: string
}

export type ApplyCodeAction = (
    ts: typeof tslib,
    sourceFile: tslib.SourceFile,
    position: number,
    range?: tslib.TextRange,
) => tslib.RefactorEditInfo | SimplifiedRefactorInfo[] | undefined

export type CodeAction = {
    name: string
    id: string
    tryToApply: ApplyCodeAction
}

const codeActions: CodeAction[] = [
    /* toggleBraces */
]

export const REFACTORS_CATEGORY = 'essential-refactors'

export default (
    ts: typeof tslib,
    sourceFile: tslib.SourceFile,
    positionOrRange: tslib.TextRange | number,
    requestingEditsId?: string,
): { info?: ts.ApplicableRefactorInfo; edit: tslib.RefactorEditInfo } => {
    const range = typeof positionOrRange !== 'number' && positionOrRange.pos !== positionOrRange.end ? positionOrRange : undefined
    const appliableCodeActions = compact(
        codeActions.map(action => {
            const edits = action.tryToApply(ts, sourceFile, typeof positionOrRange === 'number' ? positionOrRange : positionOrRange.pos, range)
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
                      } as tslib.RefactorEditInfo)
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
