import { camelCase } from 'change-case'
import { parseIgnoreSpec, findIndexOfAutoImportSpec } from './adjustAutoImports'
import { GetConfig } from './types'
import { getChangesTracker } from './utils'

export default (
    c: GetConfig,
    sourceFile: ts.SourceFile,
    importPath: string,
    preferences: ts.UserPreferences,
    formatOptions: ts.FormatCodeSettings,
    position: number,
    symbolName: string,
    entryDetailsPrior?: ts.CompletionEntryDetails,
    skipCreatingImport = false,
) => {
    const changeToNamespaceImport = Object.entries(c('autoImport.changeToNamespaceImport')).map(([key, value]) => {
        return [parseIgnoreSpec(key), value] as const
    })
    const changeToNamespaceImportSpecs = changeToNamespaceImport.map(([spec]) => spec)
    if (changeToNamespaceImport.length === 0) {
        return
    }

    const indexOfAutoImportSpec = findIndexOfAutoImportSpec(changeToNamespaceImportSpecs, importPath, '')
    if (indexOfAutoImportSpec === undefined) return
    const completionRangeStartPos = sourceFile
        .getFullText()
        .slice(0, position)
        .match(/[\w\d]*$/i)!.index!
    const { codeActions } = entryDetailsPrior ?? {}
    // if import is already added, we exit
    if (codeActions?.[0]?.changes[0]?.textChanges.length === 1) {
        const codeAction = codeActions[0]
        if (codeAction.description.startsWith('Change') && codeAction.changes[0]!.textChanges[0]!.span.start === completionRangeStartPos) {
            return
        }
    }

    const { module } = changeToNamespaceImport[indexOfAutoImportSpec]![0]
    const { namespace = camelCase(module), addImport = true, useDefaultImport } = changeToNamespaceImport[indexOfAutoImportSpec]![1]
    const textChanges = [
        {
            newText: `${namespace}.`,
            span: {
                start: completionRangeStartPos,
                length: 0,
            },
        },
    ] as ts.TextChange[]
    if (!addImport) return { textChanges, description: `Change to '${namespace}.${symbolName}'` }
    if (!skipCreatingImport) {
        const { factory } = ts
        const namespaceIdentifier = factory.createIdentifier(namespace)
        const importDeclaration = factory.createImportDeclaration(
            /*modifiers*/ undefined,
            useDefaultImport
                ? factory.createImportClause(false, namespaceIdentifier, undefined)
                : factory.createImportClause(false, undefined, factory.createNamespaceImport(namespaceIdentifier)),
            factory.createStringLiteral(importPath, preferences.quotePreference === 'single'),
        )
        const changeTracker = getChangesTracker(formatOptions)
        // todo respect sorting?
        changeTracker.insertNodeAtTopOfFile(sourceFile, importDeclaration, true)
        const changes = changeTracker.getChanges()
        const { textChanges: importTextChanges } = changes[0]!
        textChanges.unshift(...importTextChanges)
    }
    return { textChanges, description: `Add namespace import from '${importPath}'`, namespace, useDefaultImport }
}
