import { SetOptional } from 'type-fest'

export function findChildContainingPosition(typescript: typeof ts, sourceFile: ts.SourceFile, position: number): ts.Node | undefined {
    function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.getStart() && position < node.getEnd()) {
            return typescript.forEachChild(node, find) || node
        }

        return
    }
    return find(sourceFile)
}

export function findChildContainingPositionIncludingStartTrivia(typescript: typeof ts, sourceFile: ts.SourceFile, position: number): ts.Node | undefined {
    function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.getStart() - (node.getLeadingTriviaWidth() ?? 0) && position < node.getEnd()) {
            return typescript.forEachChild(node, find) || node
        }

        return
    }
    return find(sourceFile)
}

export function findChildContainingExactPosition(sourceFile: ts.SourceFile, position: number): ts.Node | undefined {
    function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.getStart() && position <= node.getEnd()) {
            return ts.forEachChild(node, find) || node
        }

        return
    }
    return find(sourceFile)
}

export function findChildContainingPositionMaxDepth(sourceFile: ts.SourceFile, position: number, maxDepth?: number): ts.Node | undefined {
    let currentDepth = 0
    function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.getStart() && position < node.getEnd()) {
            if (++currentDepth === maxDepth) return node
            return ts.forEachChild(node, find) || node
        }

        return
    }
    return find(sourceFile)
}

export function getNodePath(sourceFile: ts.SourceFile, position: number): ts.Node[] {
    const nodes: ts.Node[] = []
    function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.getStart() && position < node.getEnd()) {
            if (node !== sourceFile) nodes.push(node)
            return ts.forEachChild(node, find) || node
        }

        return
    }
    find(sourceFile)
    return nodes
}

// todo not impl
type MatchStringValue = keyof typeof ts.SyntaxKind | '*'

export const matchNodePath = (sourceFile: ts.SourceFile, position: number, candidates: MatchStringValue[][]) => {
    const nodesPath = getNodePath(sourceFile, position)
}

export const getIndentFromPos = (typescript: typeof ts, sourceFile: ts.SourceFile, position: number) => {
    const { character } = typescript.getLineAndCharacterOfPosition(sourceFile, position)
    return (
        sourceFile
            .getFullText()
            .slice(position - character, position)
            .match(/^\s+/)?.[0] ?? ''
    )
}

export const findClosestParent = (node: ts.Node, stopKinds: ts.SyntaxKind[], rejectKinds: ts.SyntaxKind[]) => {
    rejectKinds = [...rejectKinds, ts.SyntaxKind.SourceFile]
    while (node && !stopKinds.includes(node.kind)) {
        if (rejectKinds.includes(node.kind)) return
        node = node.parent
    }

    return node
}

export const getLineTextBeforePos = (sourceFile: ts.SourceFile, position: number) => {
    const { character } = sourceFile.getLineAndCharacterOfPosition(position)
    return sourceFile.getFullText().slice(position - character, position)
}

export const cleanupEntryName = ({ name }: Pick<ts.CompletionEntry, 'name'>) => {
    // intellicode highlighting
    return name.replace(/^★ /, '')
}

export const boostOrAddSuggestions = (existingEntries: ts.CompletionEntry[], topEntries: SetOptional<ts.CompletionEntry, 'sortText'>[]) => {
    const topEntryNames = topEntries.map(({ name }) => name)
    return [
        ...topEntries.map(entry => ({ ...entry, sortText: entry.sortText ?? `07` })),
        ...existingEntries.filter(({ name }) => !topEntryNames.includes(name)),
    ]
}

export const boostExistingSuggestions = (entries: ts.CompletionEntry[], predicate: (entry: ts.CompletionEntry) => boolean | number) => {
    return [...entries].sort((a, b) => {
        return [a, b]
            .map(x => {
                const res = predicate(x)
                return res === true ? 0 : res === false ? 1 : res
            })
            .reduce((a, b) => a - b)
    })
}

// Workaround esbuild bundle modules
export const nodeModules = __WEB__
    ? null
    : {
          //   emmet: require('@vscode/emmet-helper') as typeof import('@vscode/emmet-helper'),
          requireFromString: require('require-from-string'),
          fs: require('fs') as typeof import('fs'),
          util: require('util') as typeof import('util'),
          path: require('path') as typeof import('path'),
      }

/** runtime detection, shouldn't be used */
export const isWeb = () => {
    try {
        require('path')
        return false
    } catch {
        return true
    }
}

export function addObjectMethodResultInterceptors<T extends Record<string, any>>(
    object: T,
    interceptors: Partial<{
        [K in keyof Required<T> as T[K] extends (...args: any[]) => any ? K : never]: (result: ReturnType<T[K]>, ...args: Parameters<T[K]>) => ReturnType<T[K]>
    }>,
) {
    for (const key of Object.keys(interceptors)) {
        const x = object[key]!
        const callback = interceptors[key]!
        if (typeof x !== 'function') continue
        //@ts-ignore
        object[key] = (...args: any) => {
            const result = x.apply(object, args)
            return callback(result, ...args)
        }
    }
}

const wordRangeAtPos = (text: string, position: number) => {
    const isGood = (pos: number) => {
        return /[-\w\d]/i.test(text.at(pos) ?? '')
    }
    let startPos = position
    while (isGood(startPos)) {
        startPos--
    }
    let endPos = position
    while (isGood(endPos)) {
        endPos++
    }
    return text.slice(startPos + 1, endPos)
}

export function approveCast<TOut extends TIn, TIn = any>(value: TIn | undefined, test: (value: TIn) => value is TOut): value is TOut
export function approveCast<T>(value: T, test: (value: T) => boolean): T | undefined
export function approveCast<T>(value: T, test: (value: T) => boolean): T | undefined {
    return value !== undefined && test(value) ? value : undefined
}
