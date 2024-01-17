import { GetConfig } from '../types'
import { getFullTypeChecker } from '../utils'

const reactTypesPath = 'node_modules/@types/react/'

const symbolCache = new Map<string, boolean>()

export default (entries: ts.CompletionEntry[], node: ts.Node, position: number, languageService: ts.LanguageService, c: GetConfig) => {
    if (node.getSourceFile().languageVariant !== ts.LanguageVariant.JSX) return
    if (ts.isIdentifier(node)) node = node.parent
    if (
        ![ts.SyntaxKind.JsxOpeningFragment, ts.SyntaxKind.JsxOpeningElement, ts.SyntaxKind.JsxSelfClosingElement].includes(node.kind) &&
        !isJsxOpeningElem(position, node)
    ) {
        return
    }

    const nodeText = node.getText().slice(0, position - (node.pos + node.getLeadingTriviaWidth()))
    // workaround for <div test |></div>
    if (nodeText.includes(' ')) return
    if (c('jsxImproveElementsSuggestions.enabled')) {
        let lastPart = nodeText.split('.').at(-1)!
        if (lastPart.startsWith('<')) lastPart = lastPart.slice(1)
        const isStartingWithUpperCase = (str: string) => str[0] && str.startsWith(str[0].toUpperCase())
        // check if starts with lowercase
        if (isStartingWithUpperCase(lastPart)) {
            entries = entries.filter(entry => isStartingWithUpperCase(entry.name) && ![ts.ScriptElementKind.enumElement].includes(entry.kind))
        }
    }

    const { fileName } = node.getSourceFile()
    const interestedKinds: ts.ScriptElementKind[] = [
        ts.ScriptElementKind.variableElement,
        ts.ScriptElementKind.functionElement,
        ts.ScriptElementKind.constElement,
        ts.ScriptElementKind.letElement,
        ts.ScriptElementKind.alias,
        ts.ScriptElementKind.parameterElement,
        ts.ScriptElementKind.memberVariableElement,
        ts.ScriptElementKind.memberFunctionElement,
    ]
    const timings = {} as Record<string, number>
    const typeAtLocLog = {}
    const program = languageService.getProgram()!
    const typeChecker = program.getTypeChecker()!
    const nowGetter = tsFull.tryGetNativePerformanceHooks()!.performance
    let mark = nowGetter.now()
    const startMark = () => {
        mark = nowGetter.now()
    }
    const addMark = (name: string) => {
        timings[name] ??= 0
        timings[name] += nowGetter.now() - mark
        timings[`${name}Count`] ??= 0
        timings[`${name}Count`]++
    }
    const getIsEntryReactComponent = (entry: ts.CompletionEntry) => {
        // todo add more checks from ref https://github.com/microsoft/TypeScript/blob/e4816ed44cf9bcfe7cebb997b1f44cdb5564dac4/src/compiler/checker.ts#L30030
        // todo support classes
        const { symbol } = entry
        // tsFull.isCheckJsEnabledForFile(sourceFile, compilerOptions)
        if (!symbol) return true
        // performance: symbol coming from lib cannot be JSX element, so let's skip checking them
        // todo other decl
        const firstDeclaration = symbol.declarations?.[0]
        if (!firstDeclaration) return
        // todo-low
        const isIntrisicElem = ts.isInterfaceDeclaration(firstDeclaration.parent) && firstDeclaration.parent.name.text === 'IntrinsicElements'
        if (isIntrisicElem) return true
        // todo check
        // todo allow property access
        // only intrinsic elements can have lowercase starting and getting type of local variables might be really slow for some reason
        if (entry.name[0]?.toLowerCase() === entry.name[0]) return false
        const firstDeclarationFileName = firstDeclaration.getSourceFile().fileName
        if (firstDeclarationFileName.includes('/node_modules/typescript/lib/lib')) return false
        let shouldBeCached = firstDeclarationFileName.includes('node_modules')
        if (!shouldBeCached && firstDeclaration.getSourceFile().fileName === fileName) {
            // startMark()
            const definitionAtPosition = languageService.getDefinitionAtPosition(fileName, firstDeclaration.pos + firstDeclaration.getLeadingTriviaWidth())?.[0]
            // addMark('getDefinitionAtPosition')
            if (!definitionAtPosition) return
            shouldBeCached = definitionAtPosition.fileName.includes('node_modules')
        }
        const symbolSerialized = `${firstDeclarationFileName}#${symbol.name}`
        if (shouldBeCached && symbolCache.has(symbolSerialized)) {
            // that caching, not ideal
            return symbolCache.get(symbolSerialized)
        }
        startMark()
        const entryType = typeChecker.getTypeOfSymbolAtLocation(symbol, node)
        typeAtLocLog[entry.name] = nowGetter.now() - mark
        addMark('getTypeAtLocation')
        // todo setting to allow any?
        if (entryType.flags & ts.TypeFlags.Any) return false
        // startMark()
        const signatures = typeChecker.getSignaturesOfType(entryType, ts.SignatureKind.Call)
        // addMark('signatures')
        const result = isJsxElement(typeChecker, signatures, entryType)
        if (shouldBeCached) symbolCache.set(symbolSerialized, result)
        return result
    }

    // todo inspect div suggestion
    console.time('filterJsxComponents')
    const newEntries = entries.filter(entry => {
        // if (!entry.name[0] || entry.name[0].toLowerCase() === entry.name[0]) return false
        if (entry.kind === ts.ScriptElementKind.keyword) return false
        // todo?
        if (c('jsxImproveElementsSuggestions.filterNamespaces') && entry.kind === ts.ScriptElementKind.moduleElement) return false
        if (!c('experiments.excludeNonJsxCompletions')) return true
        // I'm not inrested personally
        if (entry.kind === ts.ScriptElementKind.classElement) return false
        if (entry.kind === ts.ScriptElementKind.localClassElement) return false
        if (!interestedKinds.includes(entry.kind)) return true
        const isEntryReactComponent = getIsEntryReactComponent(entry)
        return isEntryReactComponent
    })
    console.timeEnd('filterJsxComponents')
    console.log('filterJsxComponentsTimings', JSON.stringify(Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Math.round(v)]))))
    return newEntries
}

const isJsxOpeningElem = (position: number, node: ts.Node) => {
    // handle cases like:
    // const a = () => <|
    // function a() { return <| }
    const fullText = node
        .getSourceFile()
        .getFullText()
        .slice(0, position)
        // not needed as well
        .replace(/[\w\d]+$/, '')
    if (!fullText.endsWith('<')) return
    // todo remove this
    while (ts.isParenthesizedExpression(node)) {
        node = node.parent
    }
    if (node.kind === ts.SyntaxKind.FirstBinaryOperator && node.parent.getText() === '<') {
        return true
        // const parent = node.parent.parent;
        // if (!parent) return false
        // if (parent.kind === ts.SyntaxKind.ReturnStatement) return true
        // if (ts.is(parent))
    }
    return false
}

const isJsxElement = (typeChecker: ts.TypeChecker, signatures: readonly ts.Signature[], type: ts.Type) => {
    if (signatures.length > 0 && signatures.every(signature => getIsJsxComponentSignature(typeChecker, signature))) return true
    // allow pattern: const Component = condition ? 'div' : 'a'
    return !!(type.isUnion() && type.types.every(type => type.isStringLiteral()))
}

const getIsJsxComponentSignature = (typeChecker: ts.TypeChecker, signature: ts.Signature) => {
    let returnType: ts.Type | undefined = signature.getReturnType()
    if (!returnType) return
    // todo setting to allow any
    if (returnType.flags & ts.TypeFlags.Any) return false
    returnType = getPossiblyJsxType(returnType)
    if (!returnType) return false
    // startMark()
    // todo(perf) this seems to be taking a lot of time (mui test 180ms)
    const typeString = typeChecker.typeToString(returnType)
    // addMark('stringType')
    // todo-low resolve indentifier instead
    // or compare node name from decl (invest perf)
    if (['Element', 'ReactElement'].every(s => !typeString.startsWith(s))) return
    const declFile = returnType.getSymbol()?.declarations?.[0]?.getSourceFile().fileName
    if (!declFile?.includes(reactTypesPath)) return
    return true
}

const getPossiblyJsxType = (type: ts.Type) => {
    if (type.isUnion()) {
        for (const t of type.types) {
            if (t.flags & ts.TypeFlags.Null) continue
            if (t.flags & ts.TypeFlags.Object) {
                type = t
                break
            } else {
                return
            }
        }
    }
    return type.flags & ts.TypeFlags.Object ? type : undefined
}

const getGlobalJsxElementType = (program: ts.Program) => {
    const checker = getFullTypeChecker(program.getTypeChecker())
    const globalJsxNamespace = checker.resolveName('JSX', undefined, ts.SymbolFlags.Namespace, false)
    if (!globalJsxNamespace) return
    const exportsSymbols = checker.getExportsOfModule(globalJsxNamespace)
    const symbolTable = tsFull.createSymbolTable(exportsSymbols)
    const elementSymbol = getSymbol(checker, symbolTable, 'Element', ts.SymbolFlags.Type)
    if (!elementSymbol) return
    return checker.getDeclaredTypeOfSymbol(elementSymbol)
}

function getSymbol(
    checker: import('typescript-full').TypeChecker,
    symbols: import('typescript-full').SymbolTable,
    name: string,
    meaning: ts.SymbolFlags,
): import('typescript-full').Symbol | undefined {
    if (meaning) {
        const symbol = checker.getMergedSymbol(symbols.get(name as ts.__String)!)
        if (symbol) {
            if (symbol.flags & meaning) {
                return symbol
            }
            if (symbol.flags & ts.SymbolFlags.Alias) {
                const target = checker.getAliasedSymbol(symbol)
                if (checker.isUnknownSymbol(target) || target.flags & meaning) {
                    return symbol
                }
            }
        }
    }
    return undefined
}
