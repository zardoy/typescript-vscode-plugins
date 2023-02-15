import { SetOptional } from 'type-fest'
import * as semver from 'semver'

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

// semver: can't use compare as it incorrectly works with build postfix
export const isTs5 = () => semver.major(ts.version) >= 5

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

// spec isnt strict as well
export const notStrictStringCompletion = (entry: ts.CompletionEntry): ts.CompletionEntry => ({
    ...entry,
    // todo
    name: `◯${entry.name}`,
    insertText: entry.insertText ?? entry.name,
})

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

// have absolutely no idea why such useful utility is not publicly available
export const getChangesTracker = formatOptions => {
    return new tsFull.textChanges.ChangeTracker(/* will be normalized by vscode anyway */ '\n', tsFull.formatting.getFormatContext(formatOptions, {}))
}

export const dedentString = (string: string, addIndent = '', trimFirstLines = false) => {
    let lines = string.split('\n')
    if (trimFirstLines) {
        let hitNonEmpty = false
        lines = lines.filter(line => {
            if (!hitNonEmpty && !line) return false
            hitNonEmpty = true
            return true
        })
    }
    const minIndent = Math.min(...lines.filter(Boolean).map(line => line.match(/^\s*/)![0].length))
    return lines.map(line => addIndent + line.slice(minIndent)).join('\n')
}

export const getCancellationToken = (languageServiceHost: ts.LanguageServiceHost) => {
    let cancellationToken = languageServiceHost.getCancellationToken?.() as ts.CancellationToken | undefined
    // if (!cancellationToken) {
    //     debugger
    // }
    cancellationToken ??= {
        isCancellationRequested: () => false,
        throwIfCancellationRequested: () => {},
    }
    if (!cancellationToken.throwIfCancellationRequested) {
        cancellationToken.throwIfCancellationRequested = () => {
            if (cancellationToken!.isCancellationRequested()) {
                throw new ts.OperationCanceledException()
            }
        }
    }
    return cancellationToken
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

type GetIs<T> = T extends (elem: any) => elem is infer T ? T : never

export function approveCast<T2 extends Array<(node: ts.Node) => node is ts.Node>>(node: ts.Node | undefined, ...oneOfTest: T2): node is GetIs<T2[number]> {
    if (node === undefined) return false
    if (!oneOfTest) throw new Error('Tests are not provided')
    return oneOfTest.some(test => test(node))
}

export const patchMethod = <T, K extends keyof T>(obj: T, method: K, overriden: (oldMethod: T[K]) => T[K]) => {
    const oldValue = obj[method]
    Object.defineProperty(obj, method, {
        value: overriden(oldValue),
    })
    return () => {
        Object.defineProperty(obj, method, {
            value: oldValue,
        })
    }
}
