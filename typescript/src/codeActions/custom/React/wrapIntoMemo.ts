import { CodeAction } from '../../getCodeActions'
import { findChildContainingKind, autoImportPackage, deepFindNode } from '../../../utils'

/*
    Before: const Component = () => {...}; 
    After: const Component = memo(() => {...})
*/
export default {
    id: 'wrapIntoMemo',
    name: 'Wrap into React Memo',
    kind: 'refactor.rewrite.wrapIntoMemo',
    tryToApply(sourceFile, position, _range, node, formatOptions, languageService) {
        if (!node || !node.kind || !position) return

        const typeChecker = languageService.getProgram()!.getTypeChecker()
        const type = typeChecker.getTypeAtLocation(node)        
        const typeName = typeChecker.typeToString(type)

        if (!/(FC<{}>|\) => Element|ReactElement<)/.test(typeName)) {
            return undefined;
        }

        const reactComponent = findChildContainingKind(node!.parent, ts.SyntaxKind.Identifier);

        const fileExport = findChildContainingKind(sourceFile, ts.SyntaxKind.ExportAssignment);
        const isDefaultExport = fileExport?.getChildren().some((children) => children.kind === ts.SyntaxKind.DefaultKeyword);
        const exportIdentifier = deepFindNode(fileExport!, (node) => node?.getFullText()?.trim() === reactComponent?.getFullText().trim());

        const isAlreadyMemo = deepFindNode(fileExport!, (node) => node?.getFullText()?.trim() === "memo")

        if (isAlreadyMemo) {
            return undefined;
        }
        
        const changesTracker = autoImportPackage(sourceFile, 'react', 'memo');

        if (isDefaultExport && exportIdentifier) {

            return [
                { start: exportIdentifier!.getStart(), length: 0, newText: `memo(` },
                { start: exportIdentifier!.getEnd(), length: 0, newText: `)` },
                changesTracker.getChanges()[0]?.textChanges[0]!
            ].filter(Boolean)
        }
        
        const func = (c) => {
            if (c.getFullText().trim() === "memo") {
                return c
            }

            return ts.forEachChild(c, func)
        }

        const componentFunction = node?.parent.getChildren().find(ts.isArrowFunction)
        
        if (!componentFunction) {
            return undefined;
        }

        return [
            { start: componentFunction!.getStart(), length: 0, newText: `memo(` },
            { start: componentFunction!.getEnd(), length: 0, newText: `)` },
            changesTracker.getChanges()[0]?.textChanges[0]!
        ].filter(Boolean)
    },
} satisfies CodeAction
