import { compact } from '@zardoy/utils'
import { getExtendedCodeActions } from '../codeActions/getCodeActions'
import { NodeAtPositionResponse, RequestInputTypes, RequestOutputTypes, TriggerCharacterCommand, triggerCharacterCommands } from '../ipcTypes'
import { GetConfig } from '../types'
import { findChildContainingExactPosition, findChildContainingPosition, getNodePath } from '../utils'
import { lastResolvedCompletion } from '../completionEntryDetails'
import { overrideRenameRequest } from '../decorateFindRenameLocations'
import getEmmetCompletions from './emmet'
import objectIntoArrayConverters from './objectIntoArrayConverters'
import getFullType from './getFullType'

export const previousGetCodeActionsResult = {
    value: undefined as undefined | Array<Record<'description' | 'name', string>>,
}

export default (
    fileName: string,
    position: number,
    specialCommand: TriggerCharacterCommand,
    languageService: ts.LanguageService,
    configuration: GetConfig,
    preferences: ts.UserPreferences,
    formatOptions: ts.FormatCodeSettings | undefined,
): any => {
    const _specialCommandsParts = specialCommand.split('?')
    specialCommand = _specialCommandsParts[0]! as TriggerCharacterCommand
    const specialCommandArg = _specialCommandsParts[1] && JSON.parse(_specialCommandsParts[1])
    if (triggerCharacterCommands.includes(specialCommand) && !configuration) {
        throw new Error('no-ts-essential-plugin-configuration')
    }
    const sourceFile = languageService.getProgram()!.getSourceFile(fileName)!
    if (specialCommand === 'emmet-completions') {
        const leftNode = findChildContainingPosition(ts, sourceFile, position - 1)
        if (!leftNode) return
        return getEmmetCompletions(fileName, leftNode, sourceFile, position, languageService)
    }
    // todo rename from getTwoStepCodeActions to additionalCodeActions
    if (specialCommand === 'getTwoStepCodeActions') {
        changeType<RequestInputTypes['getTwoStepCodeActions']>(specialCommandArg)
        const node = findChildContainingPosition(ts, sourceFile, position)
        const posEnd = { pos: specialCommandArg.range[0], end: specialCommandArg.range[1] }

        const extendedCodeActions = getExtendedCodeActions(sourceFile, posEnd, languageService, undefined, undefined, specialCommandArg.diagnostics)
        return {
            turnArrayIntoObject: objectIntoArrayConverters(posEnd, node, undefined),
            extendedCodeActions,
        }
    }
    if (specialCommand === 'getExtendedCodeActionEdits') {
        changeType<RequestInputTypes['getExtendedCodeActionEdits']>(specialCommandArg)
        const { range, applyCodeActionTitle } = specialCommandArg
        const posEnd = { pos: range[0], end: range[1] }
        return getExtendedCodeActions(
            sourceFile,
            posEnd,
            languageService,
            formatOptions,
            applyCodeActionTitle,
        ) satisfies RequestOutputTypes['getExtendedCodeActionEdits']
    }
    if (specialCommand === 'twoStepCodeActionSecondStep') {
        changeType<RequestInputTypes['twoStepCodeActionSecondStep']>(specialCommandArg)
        const node = findChildContainingPosition(ts, sourceFile, position)
        const posEnd = { pos: specialCommandArg.range[0], end: specialCommandArg.range[1] }
        let data: RequestOutputTypes['twoStepCodeActionSecondStep'] | undefined
        switch (specialCommandArg.data.name) {
            case 'turnArrayIntoObject': {
                data = {
                    edits: objectIntoArrayConverters(posEnd, node, specialCommandArg.data.selectedKeyName),
                }
                break
            }
        }
        return data
    }
    if (specialCommand === 'getNodeAtPosition') {
        // ensure return data is the same as for node in getNodePath
        const node = findChildContainingPosition(ts, sourceFile, position)
        return node ? nodeToApiResponse(node) : undefined
    }
    if (specialCommand === 'getSpanOfEnclosingComment') {
        return languageService.getSpanOfEnclosingComment(fileName, position, false)
    }
    if (specialCommand === 'getNodePath') {
        const nodes = getNodePath(sourceFile, position)
        return nodes.map(node => nodeToApiResponse(node))
    }
    if (specialCommand === 'getFixAllEdits') {
        // code adopted is for asyncInSync fix for now
        const interestedCodes = [1308]
        const recordedStarts = new Set<number>()
        const diagnostics = languageService.getSemanticDiagnostics(fileName)
        const edits: ts.TextChange[] = []
        for (const { code, start, length } of diagnostics) {
            if (!interestedCodes.includes(code)) continue
            const fixes = languageService.getCodeFixesAtPosition(fileName, start!, start! + length!, [code], formatOptions ?? {}, preferences)
            for (const fix of fixes) {
                if (fix.fixName === 'fixAwaitInSyncFunction') {
                    const textChange = fix.changes[0]!.textChanges[0]!
                    const { start } = textChange.span
                    if (!recordedStarts.has(start)) {
                        recordedStarts.add(start)
                        edits.push(textChange)
                    }
                    break
                }
            }
        }
        return edits
    }
    if (specialCommand === 'removeFunctionArgumentsTypesInSelection') {
        changeType<RequestInputTypes['removeFunctionArgumentsTypesInSelection']>(specialCommandArg)

        const node = findChildContainingPosition(ts, sourceFile, position)
        if (!node) return
        if (!ts.isIdentifier(node) || !node.parent || !ts.isParameter(node.parent) || !node.parent.parent?.parameters) {
            return
        }
        const allParams = node.parent.parent.parameters
        return {
            ranges: allParams
                .map(param => {
                    if (!param.type || param.name.pos > specialCommandArg.endSelection) return
                    return [param.name.end, param.type.end]
                })
                .filter(Boolean),
        }
    }
    if (specialCommand === 'getRangeOfSpecialValue') {
        let node = findChildContainingExactPosition(sourceFile, position)
        if (!node) return
        let targetNode: undefined | ts.Node | [number, number]
        if (ts.isIdentifier(node) && node.parent) {
            node = node.parent
            if (ts.isPropertyAssignment(node)) {
                targetNode = node.initializer
            } else if ('body' in node) {
                targetNode = node.body as ts.Node
            } else if (ts.isJsxOpeningElement(node) || ts.isJsxOpeningFragment(node) || ts.isJsxSelfClosingElement(node)) {
                const pos = node.end
                targetNode = [pos, pos]
            }
        }

        if (!targetNode) {
            ts.findAncestor(node, n => {
                if (ts.isVariableDeclaration(n) && n.initializer && position < n.initializer.pos) {
                    targetNode = n.initializer
                    return true
                }
                if (ts.isCallExpression(n) && position < n.expression.end) {
                    const pos = n.expression.end + 1
                    targetNode = [pos, pos]
                    return true
                }
                if (ts.isArrowFunction(n) && position < n.body.pos) {
                    targetNode = n.body
                    return true
                }
                if ((ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n) || ts.isWhileStatement(n)) && position < n.statement.pos) {
                    targetNode = n.statement
                    return true
                }
                if (ts.isIfStatement(n) && position < n.thenStatement.pos) {
                    targetNode = n.thenStatement
                    return true
                }
                if (ts.isIfStatement(n) && position < n.thenStatement.pos) {
                    targetNode = n.thenStatement
                    return true
                }
                return false
            })
        }
        if (targetNode && !Array.isArray(targetNode)) {
            // maybe additional node handling in future
        }
        if (targetNode) {
            return {
                range: Array.isArray(targetNode) ? targetNode : [targetNode.pos, targetNode.end],
            } satisfies RequestOutputTypes['getRangeOfSpecialValue']
        }
        return
    }
    if (specialCommand === 'acceptRenameWithParams') {
        changeType<RequestInputTypes['acceptRenameWithParams']>(specialCommandArg)
        overrideRenameRequest.value = specialCommandArg
        return undefined
    }
    if (specialCommand === 'pickAndInsertFunctionArguments') {
        // const sourceFile = (info.languageService as ReturnType<typeof tsFull['createLanguageService']>).getProgram()!.getSourceFile(fileName)!
        // if (!sourceFile.identifiers) throw new Error('TS: no exposed identifiers map')
        type FunctionLocation = [name: string, nodePos: ts.Node, parameterDecl: ts.NodeArray<ts.ParameterDeclaration>] | ts.SignatureDeclaration
        const collectedNodes: FunctionLocation[] = []
        const collectNodes = (node: ts.Node) => {
            if (ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name))
                collectedNodes.push([node.parent.name.text, node.parent.name, node.parameters])
            if (ts.isFunctionLike(node) && node.name) collectedNodes.push([node.name.getText(), node.name, node.parameters])
            node.forEachChild(collectNodes)
        }
        sourceFile.forEachChild(collectNodes)
        return {
            functions: collectedNodes.map(arr => {
                return [
                    arr[0],
                    [arr[1].pos, arr[1].end],
                    compact(
                        arr[2].map(({ name, type }) => {
                            // or maybe allow?
                            if (!ts.isIdentifier(name)) return
                            return [name.text, type?.getText() ?? '']
                        }),
                    ),
                ]
            }),
        } satisfies RequestOutputTypes['pickAndInsertFunctionArguments']
    }
    if (specialCommand === 'filterBySyntaxKind') {
        const collectedNodes: RequestOutputTypes['filterBySyntaxKind']['nodesByKind'] = {}
        collectedNodes.comment ??= []
        const collectNodes = (node: ts.Node) => {
            const kind = ts.SyntaxKind[node.kind]!
            const leadingTrivia = node.getLeadingTriviaWidth(sourceFile)
            const comments = [
                ...(tsFull.getLeadingCommentRangesOfNode(node as any, sourceFile as any) ?? []),
                ...(tsFull.getTrailingCommentRanges(node as any, sourceFile as any) ?? []),
            ]
            collectedNodes.comment!.push(...comments.map(comment => ({ range: [comment.pos, comment.end] as [number, number] })))
            collectedNodes[kind] ??= []
            collectedNodes[kind]!.push({ range: [node.pos + leadingTrivia, node.end] })
            node.forEachChild(collectNodes)
        }
        sourceFile.forEachChild(collectNodes)
        return {
            nodesByKind: collectedNodes,
        } satisfies RequestOutputTypes['filterBySyntaxKind']
    }
    if (specialCommand === 'getLastResolvedCompletion') {
        return lastResolvedCompletion.value
    }
    if (specialCommand === 'getFullType') {
        const text = getFullType(languageService, sourceFile, position)
        if (!text) return
        return {
            text,
        }
    }
    if (specialCommand === 'getArgumentReferencesFromCurrentParameter') {
        const node = findChildContainingExactPosition(sourceFile, position)
        if (!node || !ts.isIdentifier(node) || !ts.isParameter(node.parent) || !ts.isFunctionLike(node.parent.parent)) return
        let functionDecl = node.parent.parent as ts.Node
        const functionParameters = node.parent.parent.parameters
        if (ts.isVariableDeclaration(functionDecl.parent)) {
            functionDecl = functionDecl.parent
        }
        const parameterIndex = functionParameters.indexOf(node.parent)
        const references = languageService.findReferences(fileName, functionDecl.pos + functionDecl.getLeadingTriviaWidth(sourceFile))
        if (!references) return

        return compact(
            references.flatMap(({ references }) => {
                return references.map(reference => {
                    const sourceFile = languageService.getProgram()!.getSourceFile(reference.fileName)!
                    const position = reference.textSpan.start

                    const node = findChildContainingExactPosition(sourceFile, position)
                    if (!node || !ts.isIdentifier(node) || !ts.isCallExpression(node.parent)) return

                    const arg = node.parent.arguments[parameterIndex]
                    if (!arg) return
                    return {
                        filename: reference.fileName,
                        ...sourceFile.getLineAndCharacterOfPosition(arg.pos + arg.getLeadingTriviaWidth(sourceFile)),
                    }
                })
            }),
        )
    }
    if (specialCommand === 'performanceInfo') {
        const toMb = (bytes: number) => Math.floor(bytes / 1024 / 1024)

        const sourceFilesContents = Object.fromEntries(
            languageService
                .getProgram()!
                .getSourceFiles()
                .map(x => [x.fileName, x.getFullText().length]),
        )
        return {
            sourceFiles: {
                totalFilesNumber: Object.keys(sourceFilesContents).length,
                total: toMb(Object.entries(sourceFilesContents).reduce((a, [, length]) => a + length, 0)),
                json: toMb(
                    Object.entries(sourceFilesContents)
                        .filter(([fileName]) => fileName.endsWith('.json'))
                        .map(x => x[1])
                        .reduce((a, b) => a + b, 0),
                ),
                top10: Object.entries(sourceFilesContents)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([fileName, size]) => ({ fileName, size: toMb(size), raw: size })),
            },
            // approx
            memoryUsedMb: toMb(process.memoryUsage().heapUsed),
        }
    }
    if (specialCommand === 'getMigrateToImportsEdits') {
        const combinedCodeFix = languageService.getCombinedCodeFix(
            { type: 'file', fileName: sourceFile.fileName },
            'requireInTs',
            ts.getDefaultFormatCodeSettings(),
            preferences,
        )
        return combinedCodeFix.changes[0]?.textChanges
    }

    if (specialCommand === 'onEnterActions') {
    }

    return null
}

function changeType<T>(arg): asserts arg is T {}

function nodeToApiResponse(node: ts.Node): NodeAtPositionResponse {
    return {
        kindName: ts.SyntaxKind[node.kind]!,
        start: node.getStart(),
        end: node.getEnd(),
    }
}
