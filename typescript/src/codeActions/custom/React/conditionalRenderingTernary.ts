import { CodeAction } from '../../getCodeActions'

/*
    Before: <div></div>
    After: { ? (<div></div>) : null}
*/
export default {
    id: 'conditionalRenderingTernary',
    name: 'Render Conditionally (ternary)',
    kind: 'refactor.surround.conditionalRenderingTernary',
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
                { start: wrapNode.getStart(), length: 0, newText: ` ? (` },
                { start: wrapNode.getEnd(), length: 0, newText: `) : null` },
            ]
        }
        
        return [
            { start: wrapNode.getStart(), length: 0, newText: `{ ? (` },
            { start: wrapNode.getEnd(), length: 0, newText: `) : null}` },
        ]
    },
} satisfies CodeAction
