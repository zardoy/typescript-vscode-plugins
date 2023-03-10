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

export function findChildContainingKind(sourceNode: ts.Node, kind: ts.SyntaxKind) {
    function find(node: ts.Node): ts.Node | undefined {
        if (!node) {
            return;
        }

        if (node.kind === kind) {
            return node;
        }

        return ts.forEachChild(node, find);
    }

    return find(sourceNode);
}

export function deepFindNode(sourceNode: ts.Node, func: ((node: ts.Node) => boolean)) {
    function find(node: ts.Node): ts.Node | undefined {
        if (func(node)) {
           return node; 
        }

        return ts.forEachChild(node, find);
    }

    return find(sourceNode);
}

export function findParrentNode(sourceNode: ts.Node, kind: ts.SyntaxKind) {
    function find(node: ts.Node): ts.Node | undefined {
        if (!node) {
            return undefined;
        }

        if (node.kind === kind) {
            return node;
        }

        return find(node.parent)
    }

    return find(sourceNode);
}

export function autoImportPackage(sourceFile: ts.SourceFile, packageName: string, identifierName: string, isDefault?: boolean): ChangesTracker {
    function find(node: ts.Node): ts.Node | ChangesTracker | undefined {
        if (ts.isImportDeclaration(node)) {
            const childrens = node.getChildren();
            const packageNameDeclaration = childrens.find(ts.isStringLiteral)?.getFullText().trim().slice(1, -1);
            
            if (packageNameDeclaration === packageName) {
                const importClause = childrens.find(ts.isImportClause)
                const namedImport = importClause?.getChildren().find(ts.isNamedImports);

                const importIdentifier = ts.factory.createIdentifier(identifierName);
                const newImport = ts.factory.createImportSpecifier(false, undefined, importIdentifier);
                const changesTracker = getChangesTracker({})

                const isNamespaceImport = importClause?.getChildren().find(ts.isNamespaceImport);

                if (isNamespaceImport) {
                    // IDK what to do with namespace import
                    return changesTracker;
                }

                if (!namedImport) {
                    const newNamedImport = ts.factory.createNamedImports([newImport]);
                    changesTracker.insertNodeAfterComma(sourceFile, importClause?.getChildren().at(-1)!, newNamedImport)

                    return changesTracker;
                }

                if (isDefault) {
                    const isDefaultImportExists = importClause?.getChildren().find(ts.isIdentifier);

                    if (isDefaultImportExists) {
                        return changesTracker;
                    }

                    changesTracker.insertNodeBefore(sourceFile, importClause?.getChildren().at(0)!, importIdentifier);

                    return changesTracker;
                }

                const existingImports = namedImport.getChildren()[1]!.getChildren()

                if (existingImports.map(existingImport => existingImport.getFullText().trim()).includes(identifierName)) {
                    return changesTracker;
                }

                const lastImport = existingImports.at(-1)

                changesTracker.insertNodeInListAfter(sourceFile, lastImport!, newImport)

                return changesTracker;
            }
            
        }

        return ts.forEachChild(node, find);
    }

    const result =  find(sourceFile);

    // No package import
    if (!result) {
        const changesTracker = getChangesTracker({})

        const importIdentifier = ts.factory.createIdentifier(identifierName);
        const newImport = ts.factory.createImportSpecifier(false, undefined, importIdentifier);
        const namedImport = ts.factory.createNamedImports([newImport])
        const importClause = isDefault ? ts.factory.createImportClause(false, importIdentifier, undefined) : ts.factory.createImportClause(false, undefined, namedImport);
        const packageLiteral = ts.factory.createStringLiteral(packageName);

        const importDeclaration = ts.factory.createImportDeclaration(undefined, importClause, packageLiteral);

        changesTracker.insertNodeAtTopOfFile(sourceFile, importDeclaration, false);

        return changesTracker;
    }

    return result as ChangesTracker;
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

export const isTsPatched = () => {
    try {
        const testFunction: any = () => {}
        const unpatch = patchMethod(ts, 'findAncestor', () => testFunction)
        const isPatched = ts.findAncestor === testFunction
        unpatch()
        return isPatched
    } catch (err) {
        return false
    }
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

type OriginalTypeChecker = import('typescript-full').textChanges.ChangeTracker

type ChangeParameters<T extends any[]> = {
    [K in keyof T]: T[K] extends import('typescript-full').SourceFile ? ts.SourceFile : T[K] extends import('typescript-full').Node ? ts.Node : T[K]
}

type ChangesTracker = {
    [K in keyof OriginalTypeChecker]: (...args: ChangeParameters<Parameters<OriginalTypeChecker[K]>> & any[]) => ReturnType<OriginalTypeChecker[K]>
}

// have absolutely no idea why such useful utility is not publicly available
export const getChangesTracker = formatOptions => {
    return new tsFull.textChanges.ChangeTracker(
        /* will be normalized by vscode anyway */ '\n',
        tsFull.formatting.getFormatContext(formatOptions, {}),
    ) as unknown as ChangesTracker
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

export const createDummySourceFile = (code: string) => {
    return ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, false)
}

export function approveCast<T2 extends Array<(node: ts.Node) => node is ts.Node>>(node: ts.Node | undefined, ...oneOfTest: T2): node is GetIs<T2[number]> {
    if (node === undefined) return false
    if (!oneOfTest) throw new Error('Tests are not provided')
    return oneOfTest.some(test => test(node))
}

export const patchMethod = <T, K extends keyof T>(obj: T, method: K, overriden: (oldMethod: T[K]) => T[K]) => {
    const oldValue = obj[method] as (...args: any) => any
    Object.defineProperty(obj, method, {
        value: overriden(oldValue.bind(obj) as any),
    })
    return () => {
        Object.defineProperty(obj, method, {
            value: oldValue,
        })
    }
}
