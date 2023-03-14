import { GetConfig } from '../types'

const reactTypesPath = 'node_modules/@types/react/index.d.ts'

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
        const isStartingWithUpperCase = (str: string) => str[0] && str[0] === str[0].toUpperCase()
        // check if starts with lowercase
        if (isStartingWithUpperCase(lastPart)) {
            entries = entries.filter(entry => isStartingWithUpperCase(entry.name) && ![ts.ScriptElementKind.enumElement].includes(entry.kind))
        }
    }

    const fileName = node.getSourceFile().fileName
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
    const timings = {}
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
        timings[name + 'Count'] ??= 0
        timings[name + 'Count']++
    }
    const getIsJsxComponentSignature = (signature: ts.Signature) => {
        let returnType: ts.Type | undefined = signature.getReturnType()
        if (!returnType) return
        // todo setting to allow any!
        if (returnType.flags & ts.TypeFlags.Any) return false
        returnType = getPossiblyJsxType(returnType)
        if (!returnType) return false
        startMark()
        // todo(perf) this seems to be taking a lot of time (mui test 180ms)
        const typeString = typeChecker.typeToString(returnType)
        addMark('stringType')
        // todo-low resolve indentifier instead
        // or compare node name from decl (invest perf)
        if (['Element', 'ReactElement'].every(s => !typeString.startsWith(s))) return
        const declFile = returnType.getSymbol()?.declarations?.[0]?.getSourceFile().fileName
        if (!declFile?.endsWith(reactTypesPath)) return
        return true
    }
    const getIsEntryReactComponent = (entry: ts.CompletionEntry) => {
        // todo add more checks from ref https://github.com/microsoft/TypeScript/blob/e4816ed44cf9bcfe7cebb997b1f44cdb5564dac4/src/compiler/checker.ts#L30030
        // todo support classes
        const symbol = entry['symbol'] as ts.Symbol
        // tsFull.isCheckJsEnabledForFile(sourceFile, compilerOptions)
        // symbol.declarations
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
            const definitionAtPosition = languageService.getDefinitionAtPosition(fileName, firstDeclaration.pos + 1)?.[0]
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
        const result = signatures.length > 0 && signatures.every(signature => getIsJsxComponentSignature(signature))
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

const getReactElementType = (program: ts.Program) => {
    const reactDeclSource = program.getSourceFiles().find(name => name.fileName.endsWith(reactTypesPath))
    const namespace = reactDeclSource && ts.forEachChild(reactDeclSource, s => ts.isModuleDeclaration(s) && s.name.text === 'React' && s)
    if (!namespace || !namespace.body) return
    return ts.forEachChild(namespace.body, node => {
        if (ts.isInterfaceDeclaration(node) && node.name.text === 'ReactElement') {
            return node
        }
        return
    })
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
