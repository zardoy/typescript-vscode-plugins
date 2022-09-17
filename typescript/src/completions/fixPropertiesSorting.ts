import type tslib from 'typescript/lib/tsserverlibrary'

export default (
    position: number,
    node: tslib.Node | undefined,
    scriptSnapshot: tslib.IScriptSnapshot,
    sourceFile: tslib.SourceFile,
    program: tslib.Program,
    ts: typeof tslib,
) => {
    if (!node) return
    // TO BE DONE HERE
    // const typeChecker = program.getTypeChecker()
    // const type = typeChecker.getTypeAtLocation(node)
    // console.log(typeChecker.getAugmentedPropertiesOfType(type).map(({ name }) => name))
}
