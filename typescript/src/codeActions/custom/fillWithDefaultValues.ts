import { compact } from '@zardoy/utils'
import { approveCast, getChangesTracker } from '../../utils'
import { CodeAction } from '../getCodeActions'

export default {
    name: 'Fill with @default Values',
    id: 'fillWithDefaultValues',
    kind: 'refactor.rewrite.split-declaration-and-initialization',
    tryToApply(sourceFile, position, range, node, formatOptions, languageService) {
        if (!range || !node) return
        // requires full explicit object selection (be aware of comma) to not be annoying with suggestion
        if (!approveCast(node, ts.isObjectLiteralExpression) || !(range.pos === node.pos + node.getLeadingTriviaWidth() && range.end === node.end)) {
            return
        }
        if (!formatOptions) return true
        const typeChecker = languageService.getProgram()!.getTypeChecker()!
        const type = typeChecker.getContextualType(node) ?? typeChecker.getTypeAtLocation(node)
        const properties = type.getProperties()

        const propertiesToAdd = compact(
            properties.map(prop => {
                const jsDocTags = prop.getJsDocTags()
                const defaultJsdoc = jsDocTags.find(tag => tag.name === 'default')
                if (!defaultJsdoc?.text) return
                const text = ts.displayPartsToString(defaultJsdoc.text).trim()
                const parsed = text.match(/^('|").+?\1/)?.[0] ?? text.match(/^([\d.]+)\b/)?.[1] ?? text.match(/^(true|false)\b/)?.[1]
                if (!parsed) return
                return [prop.name, parsed] as const
            }),
        )

        return [
            {
                start: node.pos + node.getLeadingTriviaWidth() + 1,
                length: 0,
                newText: propertiesToAdd.map(([name, parsed]) => `${name}: ${parsed}`).join(',\n'),
            },
        ]
    },
} satisfies CodeAction
