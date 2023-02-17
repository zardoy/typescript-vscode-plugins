import { GetConfig } from './types'
import { findChildContainingExactPosition } from './utils'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, languageServiceHost: ts.LanguageServiceHost, c: GetConfig) => {
    proxy.getSignatureHelpItems = (fileName, position, options) => {
        if (!c('signatureHelp.excludeBlockScope') || options?.triggerReason?.kind !== 'invoked') {
            return languageService.getSignatureHelpItems(fileName, position, options)
        }

        const sourceFile = languageService.getProgram()!.getSourceFile(fileName)!
        const node = findChildContainingExactPosition(sourceFile, position)
        const returnStatement =
            ts.findAncestor(node, node => {
                return ts.isBlock(node) ? 'quit' : ts.isReturnStatement(node)
            }) ?? tsFull.findPrecedingToken?.(position, sourceFile as FullSourceFile)?.kind === ts.SyntaxKind.ReturnKeyword

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
