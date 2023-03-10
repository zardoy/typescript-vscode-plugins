import pluralize from 'pluralize';
import { isIdentifier, SyntaxKind, TypeFlags } from 'typescript-full';
import { autoImportPackage, findChildContainingPosition, findParrentNode, getChangesTracker, getIndentFromPos } from '../../../utils';
import { CodeAction } from '../../getCodeActions'

/*
    Before: {items} 
    After: {items.map((item) => <div key={item.id}>  </div>)}
*/
export default {
    id: 'createJSXMap',
    name: 'Map this array to JSX',
    kind: 'refactor.rewrite.createJSXMap',
    tryToApply(sourceFile, position, _range, node, formatOptions, languageService) {
        if (!node || !node.parent || !position) return

        const prevNode = findChildContainingPosition(ts, sourceFile, position - 2);

        if (prevNode && ts.isIdentifier(prevNode)) {
            node = prevNode;
        }
        
        if (!ts.isIdentifier(node) || !findParrentNode(node, ts.SyntaxKind.JsxExpression)) {
            return undefined;
        }

        const typeChecker = languageService.getProgram()!.getTypeChecker()
        const type = typeChecker.getTypeAtLocation(node)        

    
        const typeName = typeChecker.typeToString(type)
        const isArrayType = typeName.trim().endsWith('[]');

        if (!isArrayType) {
            return undefined;
        }
        
        const arrayType = type.getNumberIndexType();

        if (!arrayType) {
            return; 
        }
    
        const isHasId = arrayType?.getProperties().some(key => key.name === 'id')

        const varName = node.getFullText().trim().replace(/^(?:all)?(.+?)(?:List)?$/, '$1')
        let inferredName = varName && pluralize.singular(varName)

        if (inferredName === varName) {
            inferredName = "item"
        }

        const indent = getIndentFromPos(ts, sourceFile, position)

        return [
            { start: node.getEnd(), length: 0, newText: `.map((${inferredName}) => (\n${indent}  <div${isHasId ? ` key={${inferredName}.id}` : ''}>\n${indent}    \n${indent}  </div>\n${indent}))` },
        ]
        
    },
} satisfies CodeAction
