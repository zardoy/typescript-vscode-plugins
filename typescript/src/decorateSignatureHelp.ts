import { getTupleSignature } from './tupleSignature'
import { GetConfig } from './types'
import { findChildContainingExactPosition } from './utils'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, languageServiceHost: ts.LanguageServiceHost, c: GetConfig) => {
    proxy.getSignatureHelpItems = (fileName, position, options) => {
        const program = languageService.getProgram()!
        const sourceFile = program.getSourceFile(fileName)!
        let node: ts.Node | undefined

        if (c('tupleHelpSignature')) {
            node ??= findChildContainingExactPosition(sourceFile, position)
            const tupleSignature = node && getTupleSignature(node, program.getTypeChecker()!)
            if (tupleSignature && node) {
                const { tupleMembers, currentMember } = tupleSignature
                const nodeStart = node.getLeadingTriviaWidth() + node.pos
                return {
                    argumentCount: tupleMembers.length,
                    argumentIndex: currentMember,
                    selectedItemIndex: 0,
                    applicableSpan: ts.createTextSpanFromBounds(nodeStart, node.end),
                    items: [
                        {
                            isVariadic: false,
                            tags: [],
                            prefixDisplayParts: [{ kind: 'text', text: '[' }],
                            suffixDisplayParts: [{ kind: 'text', text: ']' }],
                            documentation: [],
                            separatorDisplayParts: [{ kind: 'text', text: ', ' }],
                            parameters: tupleMembers.map(tupleMember => ({
                                name: '',
                                displayParts: [{ kind: 'text', text: tupleMember }],
                                documentation: [],
                                isOptional: false,
                            })),
                        },
                    ] as ts.SignatureHelpItem[],
                } as ts.SignatureHelpItems
            }
        }

        if (!c('signatureHelp.excludeBlockScope') || options?.triggerReason?.kind !== 'invoked') {
            return languageService.getSignatureHelpItems(fileName, position, options)
        }

        node ??= findChildContainingExactPosition(sourceFile, position)
        const returnStatement =
            ts.findAncestor(node, node => {
                return ts.isBlock(node) ? 'quit' : ts.isReturnStatement(node)
            }) ?? (tsFull.findPrecedingToken?.(position, sourceFile as any)?.kind as any) === ts.SyntaxKind.ReturnKeyword

        return languageService.getSignatureHelpItems(
            fileName,
            position,
            returnStatement
                ? options
                : {
                      triggerReason: {
                          kind: 'retrigger',
                      },
                  },
        )
    }
}
