import { CodeAction } from '../../getCodeActions'
import { findChildContainingKind, autoImportPackage, deepFindNode } from '../../../utils'
import {CustomizedLanguageService} from 'ts-react-hooks-tools/dist/service'
import {RefactorKind} from 'ts-react-hooks-tools/dist/types'

let service: CustomizedLanguageService

const getReactRefactoring = (languageService: ts.LanguageService, languageServiceHost: ts.LanguageServiceHost, fileName: string, range: ts.TextRange, full: boolean) => {
    service ??= new CustomizedLanguageService({
        config: {},
        languageService,
        languageServiceHost,
    } as any, ts, {
        log() { }
    } as any, { config: {} } as any)
    
    const program = languageService.getProgram()!
    return service.getInfo(range.pos, range.end, program.getSourceFile(fileName)!, program, full)
}

/*
    Before: const Component = () => {...};
    After: const Component = memo(() => {...})
*/
export default {
    id: 'wrapIntoMemo',
    name: 'Wrap into React Memo',
    kind: 'refactor.rewrite.wrapIntoMemo',
    tryToApply(sourceFile, position, range, node, formatOptions, languageService, languageServiceHost) {
        if (!node) return
        
        function getPatchedRange(position: number): ts.TextRange | undefined {
            // allow this activation range: [|const a|] = b + c
            if (!node) return
            if (ts.isIdentifier(node) && ts.isVariableDeclaration(node.parent)) node = node.parent.parent
            if (!ts.isVariableDeclarationList(node)) return
            const declarationName = node.declarations[0]?.name
            if (!declarationName) return
            if (position > declarationName.end) return
            return node
        }
        
        const patchedRange = position ? getPatchedRange(position) : range
        if (!patchedRange) return
        const info = getReactRefactoring(languageService, languageServiceHost, sourceFile.fileName, patchedRange, !!formatOptions)
        // good position or range
        if (info?.kind === RefactorKind.useMemo) {
            if (!formatOptions) return true
            const formatContext = tsFull.formatting.getFormatContext(
                formatOptions,
                languageServiceHost
            );
            const textChangesContext = {
                formatContext,
                host: languageServiceHost,
                preferences: {} // pass only if string factory is used
            };
            const {edits: [edit]} = service.getEditsForConvertUseMemo(info, sourceFile, textChangesContext)
            const hasReact = (sourceFile as FullSourceFile).identifiers.has('React')
            // TODO patch output
            return {edits: [edit!]}
        }
        
        const checker = languageService.getProgram()!.getTypeChecker()
        const type = checker.getTypeAtLocation(node)
        const typeName = checker.typeToString(type)
        
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
