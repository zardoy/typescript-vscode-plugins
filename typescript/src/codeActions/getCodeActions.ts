import { compact } from '@zardoy/utils'
import { Except } from 'type-fest'
import { findChildContainingExactPosition, findChildContainingPosition } from '../utils'
import { ApplyExtendedCodeActionResult, IpcExtendedCodeAction } from '../ipcTypes'
import { GetConfig } from '../types'
import objectSwapKeysAndValues from './custom/objectSwapKeysAndValues'
import changeStringReplaceToRegex from './custom/changeStringReplaceToRegex'
import splitDeclarationAndInitialization from './custom/splitDeclarationAndInitialization'
import declareMissingProperties from './extended/declareMissingProperties'
import { renameParameterToNameFromType, renameAllParametersToNameFromType } from './custom/renameParameterToNameFromType'
import addDestructure_1 from './custom/addDestructure/addDestructure'
import fromDestructure_1 from './custom/fromDestructure/fromDestructure'
import fixClosingTagName from './custom/fixClosingTagName'
import declareMissingAttributes from './extended/declareMissingAttributes'

const codeActions: CodeAction[] = [
    addDestructure_1,
    fromDestructure_1,
    objectSwapKeysAndValues,
    changeStringReplaceToRegex,
    splitDeclarationAndInitialization,
    renameParameterToNameFromType,
    renameAllParametersToNameFromType,
    fixClosingTagName,
]
const extendedCodeActions: ExtendedCodeAction[] = [declareMissingProperties, declareMissingAttributes]

type SimplifiedRefactorInfo =
    | {
          start: number
          length: number
          newText: string
      }
    | ts.TextChange

export type ApplyCodeAction = (
    sourceFile: ts.SourceFile,
    position: number,
    range: ts.TextRange | undefined,
    node: ts.Node | undefined,
    /** undefined when no edits is requested */
    formatOptions: ts.FormatCodeSettings | undefined,
    languageService: ts.LanguageService,
    languageServiceHost: ts.LanguageServiceHost,
) => ts.RefactorEditInfo | SimplifiedRefactorInfo[] | true | undefined

export type CodeAction = {
    name: string
    id: string
    /** Base kind https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.d.ts#L2236 */
    kind: string
    tryToApply: ApplyCodeAction
}

export type ApplyExtendedCodeAction = (options: {
    sourceFile: ts.SourceFile
    position: number
    range: ts.TextRange | undefined
    node: ts.Node | undefined
    /** undefined when no edits is requested */
    formatOptions: ts.FormatCodeSettings | undefined
    languageService: ts.LanguageService
    c: GetConfig
    // languageServiceHost: ts.LanguageServiceHost
}) => ApplyExtendedCodeActionResult | boolean | undefined

// extended code actions support snippets and diagnostic codes (so they can be quickfixes)
export type ExtendedCodeAction = {
    title: string
    // id: string
    kind: string
    tryToApply: ApplyExtendedCodeAction
    codes?: number[]
}

type Satisfies<T, U extends T> = any

// ensure props are in sync
type CheckCodeAction = Satisfies<Except<ExtendedCodeAction, 'tryToApply'>, IpcExtendedCodeAction>

export const getExtendedCodeActions = <T extends string | undefined>(
    sourceFile: ts.SourceFile,
    positionOrRange: ts.TextRange | number,
    languageService: ts.LanguageService,
    // languageServiceHost: ts.LanguageServiceHost,
    formatOptions: ts.FormatCodeSettings | undefined,
    applyCodeActionTitle: T,
    config: GetConfig,
    filterErrorCodes?: number[],
): T extends undefined ? ExtendedCodeAction[] : ApplyExtendedCodeActionResult => {
    const range = typeof positionOrRange !== 'number' && positionOrRange.pos !== positionOrRange.end ? positionOrRange : undefined
    const position = typeof positionOrRange === 'number' ? positionOrRange : positionOrRange.pos
    const node = findChildContainingExactPosition(sourceFile, position)
    const tryToApplyOptions = {
        formatOptions,
        languageService,
        // languageServiceHost,
        node,
        position,
        range,
        sourceFile,
        c: config,
    }
    if (applyCodeActionTitle) {
        const codeAction = extendedCodeActions.find(codeAction => codeAction.title === applyCodeActionTitle)
        return codeAction!.tryToApply(tryToApplyOptions) as T extends undefined ? never : ApplyExtendedCodeActionResult
    }
    return compact(
        extendedCodeActions.map(codeAction => {
            if (
                !filterErrorCodes ||
                !codeAction.codes ||
                (codeAction.codes.some(c => filterErrorCodes.includes(c)) && codeAction.tryToApply(tryToApplyOptions))
            ) {
                return codeAction
            }
            return
        }),
    ) as T extends undefined ? ExtendedCodeAction[] : never
}

export const REFACTORS_CATEGORY = 'essential-refactors'

// main function to get regular TS refactoring code actions
export default (
    sourceFile: ts.SourceFile,
    positionOrRange: ts.TextRange | number,
    languageService: ts.LanguageService,
    languageServiceHost: ts.LanguageServiceHost,
    formatOptions?: ts.FormatCodeSettings,
    requestingEditsId?: string,
): { info?: ts.ApplicableRefactorInfo; edit: ts.RefactorEditInfo } => {
    const range = typeof positionOrRange !== 'number' && positionOrRange.pos !== positionOrRange.end ? positionOrRange : undefined
    const pos = typeof positionOrRange === 'number' ? positionOrRange : positionOrRange.pos
    const node = findChildContainingExactPosition(sourceFile, pos)
    const appliableCodeActions = compact(
        codeActions.map(action => {
            const edits = action.tryToApply(sourceFile, pos, range, node, formatOptions, languageService, languageServiceHost)
            if (edits === true) return action
            if (!edits) return
            return {
                ...action,
                edits: Array.isArray(edits)
                    ? {
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
                      }
                    : edits,
            }
        }),
    )

    const requestingEdit: any = requestingEditsId ? appliableCodeActions.find(({ id }) => id === requestingEditsId) : null
    return {
        info:
            (appliableCodeActions.length > 0 && {
                actions: appliableCodeActions.map(({ id, name, kind }) => ({
                    description: name,
                    kind,
                    name: id,
                })),
                // not visible in ui anyway
                description: 'Essential Refactors',
                name: REFACTORS_CATEGORY,
            }) ||
            undefined,
        edit: requestingEdit?.edits,
    }
}
