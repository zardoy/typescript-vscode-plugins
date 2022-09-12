import type tslib from 'typescript/lib/tsserverlibrary'

export function findChildContainingPosition(
    typescript: typeof import('typescript/lib/tsserverlibrary'),
    sourceFile: tslib.SourceFile,
    position: number,
): tslib.Node | undefined {
    function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.getStart() && position < node.getEnd()) {
            return typescript.forEachChild(node, find) || node
        }

        return
    }
    return find(sourceFile)
}

export function findChildContainingPositionMaxDepth(
    typescript: typeof import('typescript/lib/tsserverlibrary'),
    sourceFile: tslib.SourceFile,
    position: number,
    maxDepth?: number,
): tslib.Node | undefined {
    let currentDepth = 0
    function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.getStart() && position < node.getEnd()) {
            if (++currentDepth === maxDepth) return node
            return typescript.forEachChild(node, find) || node
        }

        return
    }
    return find(sourceFile)
}
