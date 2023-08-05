import { RequestInputTypes } from './ipcTypes'
import { GetConfig } from './types'
import { findChildContainingExactPosition } from './utils'

export const overrideRenameRequest = {
    value: undefined as undefined | RequestInputTypes['acceptRenameWithParams'],
}

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, c: GetConfig) => {
    proxy.findRenameLocations = (
        ...args: [
            fileName: string,
            position: number,
            findInStrings: boolean,
            findInComments: boolean,
            providePrefixAndSuffixTextForRename?: boolean | ts.UserPreferences,
        ]
    ) => {
        if (overrideRenameRequest.value) {
            const { comments, strings, alias } = overrideRenameRequest.value
            if (comments !== undefined) {
                args[3] = comments
            }
            if (strings !== undefined) {
                args[2] = strings
            }
            if (alias !== undefined) {
                if (typeof args[4] === 'object') {
                    args[4] = {
                        ...args[4],
                        providePrefixAndSuffixTextForRename: alias,
                    }
                } else {
                    args[4] = alias
                }
            }

            overrideRenameRequest.value = undefined
        }

        //@ts-expect-error
        const renameLocations = languageService.findRenameLocations(...args)
        if (!renameLocations) return renameLocations
        // const firstLocation = renameLocations[0]
        // if (firstLocation?.fileName === args[0]) {
        //     const node = findChildContainingExactPosition(languageService.getProgram()!.getSourceFile(args[0])!, firstLocation.textSpan.start)
        //     if (
        //         node &&
        //         ts.isIdentifier(node) &&
        //         ts.isArrayBindingPattern(node.parent) &&
        //         node.parent.elements.length === 2 &&
        //         ts.isVariableDeclaration(node.parent.parent)
        //     ) {
        //         // firstLocation.
        //     }
        // }
        return renameLocations
    }
}
