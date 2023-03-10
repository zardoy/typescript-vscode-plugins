import { CodeAction } from '../../getCodeActions'

/*
    Before: <div></div>
    After: { && (<div></div>)}
*/
export default {
    id: 'conditionalRendering',
    name: 'Wrap into Condition',
    kind: 'refactor.rewrite.conditionalRendering',
    tryToApply(sourceFile, position, _range, node, formatOptions) {
        if (!node || !position) return

        const isSelection = ts.isJsxOpeningElement(node);
        const isSelfClosingElement = node.parent && ts.isJsxSelfClosingElement(node.parent);

        if (!isSelection && !isSelfClosingElement && (!ts.isIdentifier(node) || (!ts.isJsxOpeningElement(node.parent) && !ts.isJsxClosingElement(node.parent)))) {
            return;
        }

        const wrapNode = isSelection || isSelfClosingElement ? node.parent : node.parent.parent;

        const isTopJsxElement = ts.isJsxElement(wrapNode.parent)

        if (!isTopJsxElement) { 
            return [
                { start: wrapNode.getStart(), length: 0, newText: ` && (` },
                { start: wrapNode.getEnd(), length: 0, newText: `)` },
            ]
        }
    
        return [
            { start: wrapNode.getStart(), length: 0, newText: `{ && (` },
            { start: wrapNode.getEnd(), length: 0, newText: `)}` },
        ]
    },
} satisfies CodeAction
