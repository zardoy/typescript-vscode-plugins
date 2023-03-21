import { join } from 'path-browserify'
import { GetConfig } from './types'
import { findChildContainingExactPosition } from './utils'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, languageServiceHost: ts.LanguageServiceHost, c: GetConfig) => {
    proxy.getDefinitionAndBoundSpan = (fileName, position) => {
        const prior = languageService.getDefinitionAndBoundSpan(fileName, position)
        if (!prior) {
            const program = languageService.getProgram()!
            const sourceFile = program.getSourceFile(fileName)!
            const node = findChildContainingExactPosition(sourceFile, position)
            if (node && ts.isStringLiteral(node)) {
                const textSpanStart = node.pos + node.getLeadingTriviaWidth() + 1 // + 1 for quote
                const textSpan = {
                    start: textSpanStart,
                    length: node.end - textSpanStart - 1,
                }
                if (c('enableFileDefinitions') && ['./', '../'].some(str => node.text.startsWith(str))) {
                    const file = join(fileName, '..', node.text)
                    if (languageServiceHost.fileExists?.(file)) {
                        return {
                            textSpan,
                            definitions: [
                                {
                                    containerKind: undefined as any,
                                    containerName: '',
                                    name: '',
                                    fileName: file,
                                    textSpan: { start: 0, length: 0 },
                                    kind: ts.ScriptElementKind.moduleElement,
                                    contextSpan: { start: 0, length: 0 },
                                },
                            ],
                        }
                    }
                }

                // partial fix for https://github.com/microsoft/TypeScript/issues/49033 (string literal in function call definition)
                // thoughts about type definition: no impl here, will be simpler to do this in core instead
                if (ts.isCallExpression(node.parent)) {
                    const parameterIndex = node.parent.arguments.indexOf(node)
                    const typeChecker = program.getTypeChecker()
                    const type = typeChecker.getContextualType(node.parent.expression) ?? typeChecker.getTypeAtLocation(node.parent.expression)
                    // todo handle union
                    if (type) {
                        const getDefinitionsFromKeyofType = (object: ts.Type) => {
                            const origin = object['origin'] as ts.Type | undefined
                            // handle union of type?
                            if (!origin?.isIndexType() || !(origin.type.flags & ts.TypeFlags.Object)) return
                            const properties = origin.type.getProperties()
                            const interestedMember = properties?.find(property => property.name === node.text)
                            if (interestedMember) {
                                const definitions = (interestedMember.getDeclarations() ?? []).map((declaration: ts.Node) => {
                                    const { fileName } = declaration.getSourceFile()
                                    if (ts.isPropertySignature(declaration)) declaration = declaration.name
                                    const start = declaration.pos + declaration.getLeadingTriviaWidth()
                                    return {
                                        containerKind: undefined as any,
                                        containerName: '',
                                        name: '',
                                        fileName,
                                        textSpan: { start, length: declaration.end - start },
                                        kind: ts.ScriptElementKind.memberVariableElement,
                                        contextSpan: { start: 0, length: 0 },
                                    }
                                })
                                return {
                                    textSpan,
                                    definitions,
                                }
                            }
                            return
                        }
                        // todo handle unions and string literal
                        const sig = type.getCallSignatures()[0]
                        const param = sig?.getParameters()[parameterIndex]
                        const argType = param && typeChecker.getTypeOfSymbolAtLocation(param, node)
                        if (argType) {
                            const definitions = getDefinitionsFromKeyofType(argType)
                            if (definitions) {
                                return definitions
                            }

                            if (argType.flags & ts.TypeFlags.TypeParameter) {
                                const param = argType as ts.TypeParameter
                                const constraint = param.getConstraint()
                                if (constraint) {
                                    return getDefinitionsFromKeyofType(constraint)
                                }
                            }
                        }
                    }
                }
            }
            return
        }

        if (__WEB__) {
            // let extension handle it
            // TODO failedAliasResolution
            prior.definitions = prior.definitions?.filter(def => {
                return !def.unverified || def.fileName === fileName
            })
        }

        // used after check
        const firstDef = prior.definitions![0]!
        if (
            c('changeDtsFileDefinitionToJs') &&
            prior.definitions?.length === 1 &&
            // default, namespace import or import path click
            firstDef.containerName === '' &&
            firstDef.name.slice(1, -1) === firstDef.fileName.slice(0, -'.d.ts'.length) &&
            firstDef.fileName.endsWith('.d.ts')
        ) {
            const jsFileName = `${firstDef.fileName.slice(0, -'.d.ts'.length)}.js`
            const isJsFileExist = languageServiceHost.fileExists?.(jsFileName)
            if (isJsFileExist) prior.definitions = [{ ...firstDef, fileName: jsFileName }]
        }
        if (c('miscDefinitionImprovement') && prior.definitions) {
            const filterOutReactFcDef = prior.definitions.length === 2
            prior.definitions = prior.definitions.filter(({ fileName, containerName, containerKind, kind, name, textSpan, ...rest }) => {
                const isFcDef = filterOutReactFcDef && fileName.endsWith('node_modules/@types/react/index.d.ts') && containerName === 'FunctionComponent'
                if (isFcDef) return false
                // filter out css modules index definition
                if (containerName === 'classes' && containerKind === undefined && rest['isAmbient'] && kind === 'index' && name === '__index') {
                    // ensure we don't filter out something important?
                    const nodeAtDefinition = findChildContainingExactPosition(languageService.getProgram()!.getSourceFile(fileName)!, textSpan.start)
                    let moduleDeclaration: ts.ModuleDeclaration | undefined
                    ts.findAncestor(nodeAtDefinition, node => {
                        if (ts.isModuleDeclaration(node)) {
                            moduleDeclaration = node
                            return 'quit'
                        }
                        return false
                    })
                    const cssModules = ['*.module.css', '*.module.scss', '*.module.sass', '*.module.less', '*.module.styl']
                    if (moduleDeclaration?.name.text && cssModules.includes(moduleDeclaration.name.text)) return false
                }
                return true
            })
        }
        if (c('removeVueComponentsOptionDefinition') && prior.definitions) {
            prior.definitions = prior.definitions.filter(definition => definition.containerName !== '__VLS_componentsOption')
        }

        if (c('removeModuleFileDefinitions')) {
            prior.definitions = prior.definitions?.filter(def => {
                if (
                    def.kind === ts.ScriptElementKind.moduleElement &&
                    def.name.slice(1, -1).startsWith('*.') &&
                    def.containerKind === undefined &&
                    def['isAmbient']
                ) {
                    return false
                }
                return true
            })
        }

        return prior
    }
}
