export default (typeChecker: ts.TypeChecker, symbol: ts.Symbol | undefined, node: ts.Node) => {
    const type = symbol ? typeChecker.getTypeOfSymbol(symbol) : typeChecker.getTypeAtLocation(node)
    // give another chance
    if (symbol && type['intrinsicName'] === 'error') return typeChecker.getTypeOfSymbolAtLocation(symbol, node)
    return type
}
