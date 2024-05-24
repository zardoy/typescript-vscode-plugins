import { GetConfig } from '../types'
import {
    createDummySourceFile,
    dedentString,
    findChildContainingExactPosition,
    findChildContainingPosition,
    findChildContainingPositionMaxDepth,
} from '../utils'

export const processApplicableRefactors = (
    refactorActions: ts.RefactorActionInfo[] | undefined,
    c: GetConfig,
    posOrRange: number | ts.TextRange,
    sourceFile: ts.SourceFile,
) => {
    if (!refactorActions) return
    const functionExtractors = refactorActions.filter(({ notApplicableReason }) => !notApplicableReason)
    if (functionExtractors?.length) {
        const kind = functionExtractors[0]!.kind!
        const blockScopeRefactor = functionExtractors.find(e => e.description.includes('inner function'))
        const addArrowCodeActions: ts.RefactorActionInfo[] = []
        if (blockScopeRefactor) {
            addArrowCodeActions.push({
                description: 'Extract to arrow function above',
                kind,
                name: `${blockScopeRefactor.name}_local_arrow`,
            })
        }
        let addExtractToJsxRefactor = false
        const globalScopeRefactor = functionExtractors.at(-1)
        if (globalScopeRefactor) {
            addArrowCodeActions.push({
                description: 'Extract to arrow function in global scope above',
                kind,
                name: `${globalScopeRefactor.name}_arrow`,
            })

            addExtractToJsxRefactor = typeof posOrRange !== 'number' && !!possiblyAddExtractToJsx(sourceFile, posOrRange.pos, posOrRange.end)
        }

        if (addExtractToJsxRefactor) {
            for (const refactorAction of refactorActions) {
                if (refactorAction.name.startsWith('function_scope')) {
                    refactorAction.notApplicableReason = 'JSX Element Selected. Use Extract to JSX component'
                }
            }
            refactorActions.push({
                description: 'Extract to JSX component',
                kind: 'refactor.extract.jsx',
                name: `${globalScopeRefactor!.name}_jsx`,
            })
            return
        }

        refactorActions.push(...addArrowCodeActions)
    }
}

const possiblyAddExtractToJsx = (sourceFile: ts.SourceFile, start: number, end: number): void | true => {
    if (start === end) return
    let node1 = findChildContainingPosition(ts, sourceFile, start)
    const node2 = findChildContainingExactPosition(sourceFile, end)
    if (!node1 || !node2) return
    if (ts.isIdentifier(node1)) node1 = node1.parent
    const nodeStart = node1.pos + node1.getLeadingTriviaWidth()
    let validPosition = false
    if (node1 === node2 && ts.isJsxSelfClosingElement(node1) && start === nodeStart && end === node1.end) {
        validPosition = true
    }
    if (ts.isJsxOpeningElement(node1) && ts.isJsxClosingElement(node2) && node2.parent.openingElement === node1 && start === nodeStart && end === node2.end) {
        validPosition = true
    }
    if (!validPosition) return
    return true
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
    if (!actionName.endsWith('_arrow') && !actionName.endsWith('_jsx')) return
    const originalAcitonName = actionName.replace('_local_arrow', '').replace('_arrow', '').replace('_jsx', '')
    const { edits: originalEdits, renameFilename } = languageService.getEditsForRefactor(
        fileName,
        formatOptions,
        positionOrRange,
        refactorName,
        originalAcitonName,
        preferences,
    )!
    // has random number of edits because imports can be added
    const { textChanges } = originalEdits[0]!
    const functionChange = textChanges.at(-1)!
    const oldFunctionText = functionChange.newText
    const sourceFile = languageService.getProgram()!.getSourceFile(fileName)!
    if (actionName.endsWith('_jsx')) {
        // refactor.extract.jsx implementation
        const lines = oldFunctionText.trimStart().split('\n')
        const oldFunctionSignature = lines[0]!
        const componentName = tsFull.getUniqueName('ExtractedComponent', sourceFile as unknown as FullSourceFile)
        const insertChange = textChanges.at(-2)!
        const args = insertChange.newText.slice(insertChange.newText.indexOf('(') + 1, insertChange.newText.lastIndexOf(')'))

        const newFunctionSignature = changeArgumentsToDestructured(oldFunctionSignature, formatOptions, sourceFile, componentName).replace('{}: {}', '')

        const oldSpan = sourceFile.text.slice(0, functionChange.span.start).length

        const fileEdits = [
            {
                fileName,
                textChanges: [
                    ...textChanges.slice(0, -2),
                    {
                        ...insertChange,
                        newText: `<${componentName}${
                            args &&
                            ` ${args
                                .split(', ')
                                .map(identifierText => `${identifierText}={${identifierText}}`)
                                .join(' ')}`
                        } />`,
                    },
                    {
                        span: functionChange.span,
                        newText: `${oldFunctionText.match(/\s*/)![0] + newFunctionSignature.slice(0, -2)}\n${lines.slice(1).join('\n')}`,
                    },
                ],
            },
        ]
        const diff = fileEdits[0]!.textChanges.slice(0, -1).reduce((diff, { newText, span }) => {
            const oldText = sourceFile.text.slice(span.start, span.start + span.length)
            const newSpan = newText.length
            const oldSpan = oldText.length
            diff += newSpan - oldSpan
            return diff
        }, 0)
        return {
            edits: fileEdits,
            renameFilename,
            renameLocation: functionChange.span.start + diff,
        }
    }

    const functionName = oldFunctionText.slice(oldFunctionText.indexOf('function ') + 'function '.length, oldFunctionText.indexOf('('))
    functionChange.newText = oldFunctionText
        .replace(/function /, 'const ')
        .replace('(', ' = (')
        .replace(/{\n/, '=> {\n')

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
        functionChange.newText = `${dedentString(functionChange.newText, indent, true)}\n`
    }

    // global scope
    if (!isLocal) {
        const lastNode = findChildContainingPositionMaxDepth(sourceFile, typeof positionOrRange === 'object' ? positionOrRange.pos : positionOrRange, 2)
        if (lastNode) {
            const pos = lastNode.pos + (lastNode.getFullText().match(/^\s+/)?.[0]?.length ?? 1) - 1
            functionChange.span.start = pos
        }
    }
    const fileEdits = [
        {
            fileName,
            textChanges: [...textChanges.slice(0, -2), textChanges.at(-1)!, textChanges.at(-2)!],
        },
    ]
    return {
        edits: fileEdits,
        renameLocation: tsFull.getRenameLocation(fileEdits, fileName, functionName, /*preferLastLocation*/ true),
        renameFilename,
    }
}

export function changeArgumentsToDestructured(
    oldFunctionSignature: string,
    formatOptions: ts.FormatCodeSettings,
    sourceFile: ts.SourceFile,
    componentName: string,
) {
    const { factory } = ts
    const dummySourceFile = createDummySourceFile(oldFunctionSignature)
    const functionDeclaration = dummySourceFile.statements[0] as ts.FunctionDeclaration
    const { parameters, type: returnType } = functionDeclaration
    const paramNames = parameters.map(p => p.name as ts.Identifier)
    const paramTypes = parameters.map(p => p.type!)
    const newFunction = factory.createFunctionDeclaration(
        undefined,
        undefined,
        componentName,
        undefined,
        [
            factory.createParameterDeclaration(
                undefined,
                undefined,
                factory.createObjectBindingPattern(paramNames.map(paramName => factory.createBindingElement(undefined, undefined, paramName))),
                undefined,
                factory.createTypeLiteralNode(
                    paramNames.map((paramName, i) => {
                        const type = paramTypes[i]!
                        return factory.createPropertySignature(undefined, paramName, undefined, type)
                    }),
                ),
            ),
        ],
        returnType,
        factory.createBlock([]),
    )
    // const changesTracker = getChangesTracker(formatOptions)
    // changesTracker.insertNodeAt(sourceFile, 0, newFunction)
    // const newFunctionText = changesTracker.getChanges()[0]!.textChanges[0]!;
    const newFunctionText = ts.createPrinter().printNode(ts.EmitHint.Unspecified, newFunction, sourceFile)
    return newFunctionText
}
