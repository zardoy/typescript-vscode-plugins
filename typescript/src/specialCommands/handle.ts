import { compact } from '@zardoy/utils'
import constructMethodSnippet from '../constructMethodSnippet'
import { overrideRequestPreferences } from '../decorateProxy'
import {
    GetSignatureInfoParameter,
    NodeAtPositionResponse,
    RequestOptionsTypes,
    RequestResponseTypes,
    TriggerCharacterCommand,
    triggerCharacterCommands,
} from '../ipcTypes'
import { GetConfig } from '../types'
import { findChildContainingExactPosition, findChildContainingPosition, getNodePath } from '../utils'
import getEmmetCompletions from './emmet'
import objectIntoArrayConverters from './objectIntoArrayConverters'

export const previousGetCodeActionsResult = {
    value: undefined as undefined | Record<'description' | 'name', string>[],
}

export default (
    fileName: string,
    position: number,
    specialCommand: TriggerCharacterCommand,
    languageService: ts.LanguageService,
    configuration: GetConfig,
    preferences: ts.UserPreferences,
    formatOptions: ts.FormatCodeSettings | undefined,
): void | {
    entries: []
    typescriptEssentialsResponse: any
} => {
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
        return {
            entries: [],
            typescriptEssentialsResponse: getEmmetCompletions(fileName, leftNode, sourceFile, position, languageService),
        }
    }
    if (specialCommand === 'getTwoStepCodeActions') {
        changeType<RequestOptionsTypes['getTwoStepCodeActions']>(specialCommandArg)
        const node = findChildContainingPosition(ts, sourceFile, position)
        const posEnd = { pos: specialCommandArg.range[0], end: specialCommandArg.range[1] }
        const moveToExistingFile = previousGetCodeActionsResult.value?.some(x => x.name === 'Move to a new file')

        return {
            entries: [],
            typescriptEssentialsResponse: {
                turnArrayIntoObject: objectIntoArrayConverters(posEnd, node, undefined),
                moveToExistingFile: moveToExistingFile ? {} : undefined,
            } satisfies RequestResponseTypes['getTwoStepCodeActions'],
        }
    }
    if (specialCommand === 'twoStepCodeActionSecondStep') {
        changeType<RequestOptionsTypes['twoStepCodeActionSecondStep']>(specialCommandArg)
        const node = findChildContainingPosition(ts, sourceFile, position)
        const posEnd = { pos: specialCommandArg.range[0], end: specialCommandArg.range[1] }
        let data: RequestResponseTypes['twoStepCodeActionSecondStep'] | undefined
        switch (specialCommandArg.data.name) {
            case 'turnArrayIntoObject': {
                data = {
                    edits: objectIntoArrayConverters(posEnd, node, specialCommandArg.data.selectedKeyName),
                }
                break
            }
            case 'moveToExistingFile': {
                // const refactors = languageService.getApplicableRefactors(fileName, posEnd, preferences, 'invoked')
                const { edits } =
                    languageService.getEditsForRefactor(fileName, formatOptions ?? {}, posEnd, 'Move to a new file', 'Move to a new file', preferences) ?? {}
                if (!edits) return
                data = {
                    fileEdits: edits,
                    fileNames: languageService
                        .getProgram()!
                        .getSourceFiles()
                        .map(f => f.fileName)
                        .filter(name => !name.includes('/node_modules/')),
                }
                break
            }
        }
        return {
            entries: [],
            typescriptEssentialsResponse: data,
        }
    }
    if (specialCommand === 'getNodeAtPosition') {
        // ensure return data is the same as for node in getNodePath
        const node = findChildContainingPosition(ts, sourceFile, position)
        return {
            entries: [],
            typescriptEssentialsResponse: !node ? undefined : nodeToApiResponse(node),
        }
    }
    if (specialCommand === 'getFullMethodSnippet') {
        return {
            entries: [],
            typescriptEssentialsResponse: constructMethodSnippet(
                languageService,
                sourceFile,
                position,
                configuration,
            ) satisfies RequestResponseTypes['getFullMethodSnippet'],
        }
    }
    if (specialCommand === 'getSpanOfEnclosingComment') {
        return {
            entries: [],
            typescriptEssentialsResponse: languageService.getSpanOfEnclosingComment(fileName, position, false),
        }
    }
    if (specialCommand === 'getNodePath') {
        const nodes = getNodePath(sourceFile, position)
        return {
            entries: [],
            typescriptEssentialsResponse: nodes.map(node => nodeToApiResponse(node)),
        }
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
        return {
            entries: [],
            typescriptEssentialsResponse: edits,
        } as any
    }
    if (specialCommand === 'removeFunctionArgumentsTypesInSelection') {
        changeType<RequestOptionsTypes['removeFunctionArgumentsTypesInSelection']>(specialCommandArg)

        const node = findChildContainingPosition(ts, sourceFile, position)
        if (!node) return
        if (!ts.isIdentifier(node) || !node.parent || !ts.isParameter(node.parent) || !node.parent.parent?.parameters) {
            return
        }
        const allParams = node.parent.parent.parameters
        return {
            entries: [],
            typescriptEssentialsResponse: {
                ranges: allParams
                    .map(param => {
                        if (!param.type || param.name.pos > specialCommandArg.endSelection) return
                        return [param.name.end, param.type.end]
                    })
                    .filter(Boolean),
            },
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
                entries: [],
                typescriptEssentialsResponse: {
                    range: Array.isArray(targetNode) ? targetNode : [targetNode.pos, targetNode.end],
                } satisfies RequestResponseTypes['getRangeOfSpecialValue'],
            }
        } else {
            return
        }
    }
    if (specialCommand === 'acceptRenameWithParams') {
        changeType<RequestOptionsTypes['acceptRenameWithParams']>(specialCommandArg)
        overrideRequestPreferences.rename = specialCommandArg
        return {
            entries: [],
            typescriptEssentialsResponse: undefined,
        }
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
            entries: [],
            typescriptEssentialsResponse: {
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
            } satisfies RequestResponseTypes['pickAndInsertFunctionArguments'],
        }
    }
    if (specialCommand === 'filterBySyntaxKind') {
        const collectedNodes: RequestResponseTypes['filterBySyntaxKind']['nodesByKind'] = {}
        collectedNodes.comment ??= []
        const collectNodes = (node: ts.Node) => {
            const kind = ts.SyntaxKind[node.kind]!
            const leadingTrivia = node.getLeadingTriviaWidth(sourceFile)
            const comments = [
                ...(tsFull.getLeadingCommentRangesOfNode(node as any, sourceFile as any) ?? []),
                ...(tsFull.getTrailingCommentRanges(node as any, sourceFile as any) ?? []),
            ]
            collectedNodes.comment!.push(...comments?.map(comment => ({ range: [comment.pos, comment.end] as [number, number] })))
            collectedNodes[kind] ??= []
            collectedNodes[kind]!.push({ range: [node.pos + leadingTrivia, node.end] })
            node.forEachChild(collectNodes)
        }
        sourceFile.forEachChild(collectNodes)
        return {
            entries: [],
            typescriptEssentialsResponse: {
                nodesByKind: collectedNodes,
            } satisfies RequestResponseTypes['filterBySyntaxKind'],
        }
    }
}

function changeType<T>(arg): asserts arg is T {}

function nodeToApiResponse(node: ts.Node): NodeAtPositionResponse {
    return {
        kindName: ts.SyntaxKind[node.kind]!,
        start: node.getStart(),
        end: node.getEnd(),
    }
}
