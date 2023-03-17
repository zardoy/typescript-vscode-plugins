import { text } from "stream/consumers";
import { autoImportPackage, deepFindParrentNode, findChildContainingKind, getChangesTracker } from "../../utils";
import { ExtendedCodeAction } from "../getCodeActions";

/*
    Before: 
        const Component = () => {...}; 
    After: 
        interface Props {}
        const Component: React.FC<Props> = () => {...}
*/
export default {
    title: 'Create Props Interface',
    kind: 'refactor.rewrite.createPropsInterface',
    tryToApply({ sourceFile, position, node, formatOptions, languageService }) {
        if (!node || !position) return

        const typeChecker = languageService.getProgram()!.getTypeChecker()
        const type = typeChecker.getTypeAtLocation(node)
        const typeName = typeChecker.typeToString(type)

        const isReactTypeNode = ts.isIdentifier(node) && node.parent.getText().trim() === 'React.FC';

        const isComponentNameNode = !isReactTypeNode && ts.isIdentifier(node) && /(FC<{}>|\) => Element|ReactElement<)/.test(typeName)

        if (!isReactTypeNode && !isComponentNameNode) {
            return undefined;
        }

        const reactComponent = deepFindParrentNode(node, (parrentNode) => ts.isVariableStatement(parrentNode));

        if (!reactComponent) {
            return undefined;
        }

        const componentDeclarationNode = findChildContainingKind(reactComponent, ts.SyntaxKind.VariableDeclaration);

        if (!componentDeclarationNode) {
            return undefined;
        }
        
        const componentTypeNode = componentDeclarationNode.forEachChild((child) => ts.isTypeReferenceNode(child) && child);

        const newInterface = ts.factory.createInterfaceDeclaration(undefined, 'Props', undefined, undefined, [])
        const interfaceChangesTracker = getChangesTracker(formatOptions);
        interfaceChangesTracker.insertNodeBefore(sourceFile, reactComponent, newInterface, true)
        const interfaceChanges = interfaceChangesTracker.getChanges()[0]?.textChanges[0]!;

        if (!componentTypeNode) {
            const componentNameNode = componentDeclarationNode.forEachChild((child) => ts.isIdentifier(child) && child);
    
            if (!componentNameNode) {
                return
            }

            return {
                edits: [
                    { span: { start: componentNameNode.getEnd(), length: 0 }, newText: `: React.FC<Props>` },

                ],
                snippetEdits: [
                    {
                        ...interfaceChanges,
                        newText: interfaceChanges.newText.replace('}', '\n  $0 \n}')
                    }
                ]
            }
        }

        return {
            edits: [
                { span: { start: componentTypeNode.getEnd(), length: 0 }, newText: `<Props>` },
            ],
            snippetEdits: [
                {
                    ...interfaceChanges,
                    newText: interfaceChanges.newText.replace('}', '\n  $0 \n}')
                }
            ]
        }
    },
} satisfies ExtendedCodeAction
