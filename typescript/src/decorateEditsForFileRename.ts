import { camelCase } from 'change-case'
import _ from 'lodash'
import { GetConfig } from './types'
import { approveCast, findChildContainingExactPosition } from './utils'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, c: GetConfig) => {
    proxy.getEditsForFileRename = (oldFilePath, newFilePath, formatOptions, preferences) => {
        let edits = languageService.getEditsForFileRename(oldFilePath, newFilePath, formatOptions, preferences)
        if (c('renameImportNameOfFileRename')) {
            const predictedNameFromPath = (p: string) => {
                const input = p.split(/[/\\]/g).pop()!.replace(/\..+/, '')
                const transformed = camelCase(input)
                // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
                const isFirstUppercase = input && input.startsWith(input[0]!.toUpperCase())
                return isFirstUppercase ? transformed[0]!.toUpperCase() + transformed.slice(1) : transformed
            }
            const oldPredictedName = predictedNameFromPath(oldFilePath)
            const newPredictedName = predictedNameFromPath(newFilePath)
            for (const edit of edits) {
                const possiblyAddRename = (identifier: ts.Identifier | undefined) => {
                    if (identifier?.text !== oldPredictedName) return
                    const sourceFile = languageService.getProgram()!.getSourceFile(edit.fileName)!
                    const newRenameEdits =
                        proxy.findRenameLocations(edit.fileName, identifier.pos + identifier.getLeadingTriviaWidth(), false, false, preferences ?? {}) ?? []
                    if (!newRenameEdits) return
                    // maybe cancel symbol rename on collision instead?
                    const newInsertName = tsFull.getUniqueName(newPredictedName, sourceFile as any)
                    const addEdits = Object.entries(_.groupBy(newRenameEdits, ({ fileName }) => fileName)).map(
                        ([fileName, changes]): ts.FileTextChanges => ({
                            fileName,
                            textChanges: changes.map(
                                ({ prefixText = '', suffixText = '', textSpan }): ts.TextChange => ({
                                    newText: prefixText + newInsertName + suffixText,
                                    span: textSpan,
                                }),
                            ),
                        }),
                    )
                    edits = [...edits, ...addEdits]
                }
                for (const textChange of edit.textChanges) {
                    const node = findChildContainingExactPosition(languageService.getProgram()!.getSourceFile(edit.fileName)!, textChange.span.start)
                    if (!node) continue
                    if (node && ts.isStringLiteral(node) && ts.isImportDeclaration(node.parent) && node.parent.importClause) {
                        const { importClause } = node.parent
                        possiblyAddRename(importClause?.name)
                        if (approveCast(importClause.namedBindings, ts.isNamespaceImport)) {
                            possiblyAddRename(importClause.namedBindings.name)
                        }
                    }
                }
            }
        }
        return edits
    }
}
