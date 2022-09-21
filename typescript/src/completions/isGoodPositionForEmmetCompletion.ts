export default (
    fileName: string,
    node: ts.Node,
    sourceFile: ts.SourceFile,
    position: number,
    languageService: ts.LanguageService,
    // c: GetConfig,
) => {
    const nodeText = node.getFullText().slice(0, position - node.pos)
    const { SyntaxKind } = ts
    const emmetSyntaxKinds = [SyntaxKind.JsxFragment, SyntaxKind.JsxElement, SyntaxKind.JsxText]
    const emmetClosingSyntaxKinds = [SyntaxKind.JsxClosingElement, SyntaxKind.JsxClosingFragment]
    if (emmetSyntaxKinds.includes(node.kind) || /* Just before closing tag */ (emmetClosingSyntaxKinds.includes(node.kind) && nodeText.length === 0))
        return true
    return false
}
