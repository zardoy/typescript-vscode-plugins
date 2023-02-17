import { compact } from '@zardoy/utils'
import { findChildContainingPosition } from '../utils'
import objectSwapKeysAndValues from './custom/objectSwapKeysAndValues'
import changeStringReplaceToRegex from './custom/changeStringReplaceToRegex'
import toggleBraces from './custom/toggleBraces'

type SimplifiedRefactorInfo =
    | {
          start: number
          length: number
          newText: string
      }
    | ts.TextChange[]

export type ApplyCodeAction = (
    sourceFile: ts.SourceFile,
    position: number,
    range: ts.TextRange | undefined,
    node: ts.Node | undefined,
) => ts.RefactorEditInfo | SimplifiedRefactorInfo[] | undefined

export type CodeAction = {
    name: string
    id: string
    /** Base kind https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts#L2236 */
    kind: string
    tryToApply: ApplyCodeAction
}

const codeActions: CodeAction[] = [/* toggleBraces */ objectSwapKeysAndValues, changeStringReplaceToRegex]

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
                                  textChanges: edits.map(change => {
                                      if ('start' in change) {
                                          const { newText, start, length } = change
                                          return {
                                              newText,
                                              span: {
                                                  length,
                                                  start,
                                              },
                                          }
                                      }
                                      return change
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
                actions: appliableCodeActions.map(({ id, name, kind }) => ({
                    description: name,
                    kind,
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
