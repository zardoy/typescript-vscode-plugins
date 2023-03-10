import { autoImportPackage, getChangesTracker } from '../../../utils';
import { CodeAction } from '../../getCodeActions'

/*
    Before: 
        const Component = () => {...}; 
    After: 
        interface Props {}
        const Component: React.FC<Props> = () => {...}
*/
export default {
    id: 'createPropsInterface',
    name: 'Create Props Interface',
    kind: 'refactor.rewrite.createPropsInterface',
    tryToApply(sourceFile, position, _range, node, formatOptions, languageService) {
        if (!node || !position) return

        const componentType = node.parent;

        const typeChecker = languageService.getProgram()!.getTypeChecker()
        const type = typeChecker.getTypeAtLocation(node)        
        const typeName = typeChecker.typeToString(type)


        const isReactFCType = componentType?.parent && ts.isQualifiedName(componentType) && componentType.parent.getFullText().trim() === "React.FC";
        
        const isComponentName = !isReactFCType && /(FC<{}>|\) => Element|ReactElement<)/.test(typeName)

        if (!isReactFCType && !isComponentName) {
            return undefined;
        }
        
        const reactComponent = isComponentName ? componentType.parent.parent : componentType.parent.parent.parent.parent;

        if (!reactComponent || !ts.isVariableStatement(reactComponent)) {
            return undefined;
        }

        const newInterface = ts.factory.createInterfaceDeclaration(undefined, 'Props', [], [], [])

        const changesTracker = autoImportPackage(sourceFile, 'react', 'React', true);

        changesTracker.insertNodeBefore(sourceFile, reactComponent, newInterface, true)
    
        if (isComponentName) {
            return [
                { start: node!.getEnd(), length: 0, newText: `: React.FC<Props>` },
                ...changesTracker.getChanges()[0]?.textChanges!
            ].filter(Boolean)
        }

        return [
            { start: componentType!.getEnd(), length: 0, newText: `<Props>` },
            ...changesTracker.getChanges()[0]?.textChanges!
        ].filter(Boolean)
    },
} satisfies CodeAction
