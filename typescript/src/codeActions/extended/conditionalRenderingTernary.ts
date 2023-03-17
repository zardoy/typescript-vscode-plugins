import { ExtendedCodeAction } from '../getCodeActions'

/*
    Before: <div></div>
    After: { ? (<div></div>) : null}
*/
export default {
    title: 'Render Conditionally (ternary)',
    kind: 'refactor.surround.conditionalRenderingTernary',
    tryToApply({ position, node }) {
        if (!node || !position) return

        const isSelection = ts.isJsxOpeningElement(node)
        const isSelfClosingElement = node.parent && ts.isJsxSelfClosingElement(node.parent)

        if (
            !isSelection &&
            !isSelfClosingElement &&
            (!ts.isIdentifier(node) || (!ts.isJsxOpeningElement(node.parent) && !ts.isJsxClosingElement(node.parent)))
        ) {
            return
        }

        const wrapNode = isSelection || isSelfClosingElement ? node.parent : node.parent.parent

        const isTopJsxElement = ts.isJsxElement(wrapNode.parent)

        if (!isTopJsxElement) {
            return {
                snippetEdits: [
                    { span: { start: wrapNode.getStart(), length: 0 }, newText: `$0 ? (` },
                    { span: { start: wrapNode.getEnd(), length: 0 }, newText: `) : null` },
                ],
                edits: [],
            }
        }

        return {
            snippetEdits: [
                { span: { start: wrapNode.getStart(), length: 0 }, newText: `{$0 ? (` },
                { span: { start: wrapNode.getEnd(), length: 0 }, newText: `) : null}` },
            ],
            edits: [],
        }
    },
} satisfies ExtendedCodeAction
