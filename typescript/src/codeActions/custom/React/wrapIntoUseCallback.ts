import { CodeAction } from '../../getCodeActions'
import { autoImportPackage } from '../../../utils'

/*
    Before: const func = () => value; 
    After: const func = useCallback(() => value, [])
*/
export default {
    id: 'wrapIntoUseCallback',
    name: 'Wrap into useCallback',
    kind: 'refactor.rewrite.wrapIntoUseCallback',
    tryToApply(sourceFile, position, _range, node, formatOptions, languageService) {
        if (!node || !position) return

        const [functionIdentifier, _, arrowFunction] = node.parent.getChildren()

        if (!functionIdentifier || !arrowFunction ) {
            return undefined;
        }

        if (!ts.isIdentifier(functionIdentifier) || !ts.isArrowFunction(arrowFunction)) {
            return undefined
        }
        
        // Check is react component
        const reactComponent = node?.parent?.parent?.parent?.parent?.parent?.parent

        if (!reactComponent) {
            return undefined;
        }
        
        const typeChecker = languageService.getProgram()!.getTypeChecker()
        const type = typeChecker.getTypeAtLocation(reactComponent)        
        const typeName = typeChecker.typeToString(type)

        if (!['FC<', '() => Element', 'ReactElement<'].some((el) => typeName.startsWith(el))) {
            return undefined;
        }

        const changesTracker = autoImportPackage(sourceFile, 'react', 'useCallback');

        return [
            { start: arrowFunction!.getStart(), length: 0, newText: `useCallback(` },
            { start: arrowFunction!.getEnd(), length: 0, newText: `, [])` },
            changesTracker.getChanges()[0]?.textChanges[0]!
        ].filter(Boolean);
        
    },
} satisfies CodeAction
