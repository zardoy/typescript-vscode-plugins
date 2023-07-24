export default (typeChecker: ts.TypeChecker, node: ts.Node, symbol?: ts.Symbol) => {
    const type = symbol ? typeChecker.getTypeOfSymbol(symbol) : typeChecker.getTypeAtLocation(node)
    // give another chance
    if (symbol && type['intrinsicName'] === 'error') return typeChecker.getTypeOfSymbolAtLocation(symbol, node)
    return type
}
