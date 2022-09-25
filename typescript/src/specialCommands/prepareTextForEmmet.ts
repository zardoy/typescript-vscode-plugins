export default (
    fileName: string,
    leftNode: ts.Node,
    sourceFile: ts.SourceFile,
    position: number,
    languageService: ts.LanguageService,
    // c: GetConfig,
): false | string => {
    const { SyntaxKind } = ts
    const goodKindsWithText = [SyntaxKind.JsxText]
    const justGoodKinds = [SyntaxKind.JsxFragment, SyntaxKind.JsxElement]
    const endOnlyKinds = [SyntaxKind.JsxOpeningElement, SyntaxKind.JsxOpeningFragment, SyntaxKind.JsxExpression]
    const endPos = position - leftNode.pos
    if (goodKindsWithText.includes(leftNode.kind)) return leftNode.getFullText().slice(0, endPos).split(' ').at(-1)!
    if (justGoodKinds.includes(leftNode.kind)) return ''
    if (endOnlyKinds.includes(leftNode.kind) && leftNode.end === position) return ''
    return false
}
