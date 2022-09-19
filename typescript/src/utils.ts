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

export const getIndentFromPos = (typescript: typeof import('typescript/lib/tsserverlibrary'), sourceFile: tslib.SourceFile, position: number) => {
    const { character } = typescript.getLineAndCharacterOfPosition(sourceFile, position)
    return (
        sourceFile
            .getText()
            .slice(position - character, position)
            .match(/^\s+/)?.[0] ?? ''
    )
}

export const findClosestParent = (ts: typeof tslib, node: tslib.Node, stopKinds: tslib.SyntaxKind[], rejectKinds: tslib.SyntaxKind[]) => {
    rejectKinds = [...rejectKinds, ts.SyntaxKind.SourceFile]
    while (node && !stopKinds.includes(node.kind)) {
        if (rejectKinds.includes(node.kind)) return
        node = node.parent
    }

    return node
}

export const getLineTextBeforePos = (sourceFile: ts.SourceFile, position: number) => {
    const { character } = sourceFile.getLineAndCharacterOfPosition(position)
    return sourceFile.getText().slice(position - character, position)
}
