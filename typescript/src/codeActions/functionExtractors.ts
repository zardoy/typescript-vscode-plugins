import { GetConfig } from '../types'
import { dedentString, findChildContainingPositionMaxDepth } from '../utils'

export const processApplicableRefactors = (refactor: ts.ApplicableRefactorInfo | undefined, c: GetConfig) => {
    if (!refactor) return
    const functionExtractors = refactor?.actions.filter(({ notApplicableReason }) => !notApplicableReason)
    if (functionExtractors?.length) {
        const kind = functionExtractors[0]!.kind!
        const blockScopeRefactor = functionExtractors.find(e => e.description.startsWith('Extract to inner function in'))
        if (blockScopeRefactor) {
            refactor!.actions.push({
                description: 'Extract to arrow function above',
                kind,
                name: `${blockScopeRefactor.name}_local_arrow`,
            })
        }
        const globalScopeRefactor = functionExtractors.find(e => e.description === 'Extract to function in global scope')
        if (globalScopeRefactor) {
            refactor!.actions.push({
                description: 'Extract to arrow function in global scope above',
                kind,
                name: `${globalScopeRefactor.name}_arrow`,
            })
        }
    }
}

export const handleFunctionRefactorEdits = (
    actionName: string,

    languageService: ts.LanguageService,
    fileName: string,
    formatOptions: ts.FormatCodeSettings,
    positionOrRange: number | ts.TextRange,
    refactorName: string,
    preferences: ts.UserPreferences | undefined,
): ts.RefactorEditInfo | undefined => {
    if (!actionName.endsWith('_arrow')) return
    const originalAcitonName = actionName.replace('_local_arrow', '').replace('_arrow', '')
    const { edits, renameLocation, renameFilename } = languageService.getEditsForRefactor(
        fileName,
        formatOptions,
        positionOrRange,
        refactorName,
        originalAcitonName,
        preferences,
    )!
    // has random number of edits because imports can be added
    const { textChanges } = edits[0]!
    const functionChange = textChanges.at(-1)!
    functionChange.newText = functionChange.newText
        .replace(/function /, 'const ')
        .replace('(', ' = (')
        .replace(/\{\n/, '=> {\n')

    const isLocal = actionName.endsWith('_local_arrow')
    // to think: maybe reuse ts getNodeToInsertPropertyBefore instead?
    const constantEdits = isLocal
        ? languageService.getEditsForRefactor(fileName, formatOptions, positionOrRange, refactorName, 'constant_scope_0', preferences)!.edits
        : undefined
    // local scope
    if (constantEdits) {
        const constantAdd = constantEdits[0]!.textChanges[0]!
        functionChange.span.start = constantAdd.span.start
        const indent = constantAdd.newText.match(/^\s*/)![0]
        // fix indent
        functionChange.newText = dedentString(functionChange.newText, indent, true) + '\n'
    }

    // global scope
    if (!isLocal) {
        const lastNode = findChildContainingPositionMaxDepth(
            languageService.getProgram()!.getSourceFile(fileName)!,
            typeof positionOrRange === 'object' ? positionOrRange.pos : positionOrRange,
            2,
        )
        if (lastNode) {
            const pos = lastNode.pos + (lastNode.getFullText().match(/^\s+/)?.[0]?.length ?? 1) - 1
            functionChange.span.start = pos
        }
    }
    return {
        edits: [{ fileName, textChanges }],
        // TODO since ts making edit after current location, it doesn't expect renameLocation to be changed (lets fix it)
        // renameLocation: renameLocation! + functionChange.newText.length + 1,
        renameLocation: functionChange.span.start + functionChange.newText.indexOf('const ') + 'const '.length,
        renameFilename,
    }
}
