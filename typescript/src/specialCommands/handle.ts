import { compact } from '@zardoy/utils'
import postfixesAtPosition from '../completions/postfixesAtPosition'
import { NodeAtPositionResponse, RequestOptionsTypes, RequestResponseTypes, TriggerCharacterCommand, triggerCharacterCommands } from '../ipcTypes'
import { findChildContainingPosition, getNodePath } from '../utils'
import getEmmetCompletions from './emmet'
import objectIntoArrayConverters from './objectIntoArrayConverters'

export default (
    info: ts.server.PluginCreateInfo,
    fileName: string,
    position: number,
    specialCommand: TriggerCharacterCommand,
    languageService: ts.LanguageService,
    configuration: any,
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
    const sourceFile = info.languageService.getProgram()!.getSourceFile(fileName)!
    if (specialCommand === 'emmet-completions') {
        const leftNode = findChildContainingPosition(ts, sourceFile, position - 1)
        if (!leftNode) return
        return {
            entries: [],
            typescriptEssentialsResponse: getEmmetCompletions(fileName, leftNode, sourceFile, position, info.languageService),
        }
    }
    if (specialCommand === 'turnArrayIntoObject') {
        const node = findChildContainingPosition(ts, sourceFile, position)
        changeType<RequestOptionsTypes['turnArrayIntoObject']>(specialCommandArg)
        return {
            entries: [],
            typescriptEssentialsResponse: objectIntoArrayConverters(
                { pos: specialCommandArg.range[0], end: specialCommandArg.range[1] },
                node,
                specialCommandArg.selectedKeyName,
            ),
        }
    }
    if (specialCommand === 'getNodeAtPosition') {
        const node = findChildContainingPosition(ts, sourceFile, position)
        return {
            entries: [],
            typescriptEssentialsResponse: !node ? undefined : nodeToApiResponse(node),
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
    if (specialCommand === 'getPostfixes') {
        const scriptSnapshot = info.project.getScriptSnapshot(fileName)
        if (!scriptSnapshot) return
        return {
            entries: [],
            typescriptEssentialsResponse: postfixesAtPosition(position, fileName, scriptSnapshot, info.languageService),
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
        let node = findChildContainingPosition(ts, sourceFile, position)
        if (!node) return
        let targetNode: undefined | ts.Node | [number, number]
        if (ts.isIdentifier(node) && node.parent) {
            node = node.parent
            if (ts.isPropertyAssignment(node)) {
                targetNode = node.initializer
            } else if ('body' in node) {
                targetNode = node.body as ts.Node
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
