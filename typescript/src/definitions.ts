import { join } from 'path-browserify'
import { GetConfig } from './types'
import { findChildContainingExactPosition } from './utils'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, languageServiceHost: ts.LanguageServiceHost, c: GetConfig) => {
    proxy.getDefinitionAndBoundSpan = (fileName, position) => {
        const prior = languageService.getDefinitionAndBoundSpan(fileName, position)

        if (c('removeModuleFileDefinitions') && prior) {
            prior.definitions = prior.definitions?.filter(def => {
                if (
                    def.kind === ts.ScriptElementKind.moduleElement &&
                    def.name.slice(1, -1).startsWith('*.') &&
                    def.containerKind === undefined &&
                    (def as import('typescript-full').DefinitionInfo).isAmbient
                ) {
                    return false
                }
                return true
            })
        }

        const program = languageService.getProgram()!
        const sourceFile = program.getSourceFile(fileName)!
        const getNode = () => {
            return findChildContainingExactPosition(sourceFile, position)
        }

        const noDefs = !prior || !prior.definitions || prior.definitions.length === 0
        const tryFileResolve = noDefs || ['?', '#'].some(x => prior.definitions?.[0]?.fileName?.includes(x))

        // Definition fallbacks
        if (noDefs || tryFileResolve) {
            const node = getNode()
            if (node && ts.isStringLiteral(node)) {
                const textSpanStart = node.pos + node.getLeadingTriviaWidth() + 1 // + 1 for quote
                const textSpan = {
                    start: textSpanStart,
                    length: node.end - textSpanStart - 1,
                }

                if (tryFileResolve && c('enableFileDefinitions') && ['./', '../'].some(str => node.text.startsWith(str))) {
                    const pathText = node.text.split('?')[0]!.split('#')[0]!
                    const fileCandidates = [
                        join(fileName, '..', pathText),
                        // also try to resolve from root. Why? It might common in Node.js script paths that go from working directory (project root)
                        pathText.startsWith('./') ? join(languageServiceHost.getCurrentDirectory(), pathText) : (undefined as never),
                    ].filter(Boolean)
                    const resolvedFile = fileCandidates.find(file => languageServiceHost.fileExists?.(file))
                    if (resolvedFile) {
                        return {
                            textSpan,
                            definitions: [
                                {
                                    containerKind: undefined as any,
                                    containerName: '',
                                    name: '',
                                    fileName: resolvedFile,
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
                if (noDefs && ts.isCallExpression(node.parent)) {
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

            if (noDefs) return prior
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
            const program = languageService.getProgram()!
            const sourceFile = program.getSourceFile(fileName)!

            const lines = sourceFile.getFullText().split('\n')
            const { line: curLine } = ts.getLineAndCharacterOfPosition(sourceFile, position)

            const VLS_COMPONENT_STRINGS = ['__VLS_templateComponents', '__VLS_components']

            const isVLSComponent = VLS_COMPONENT_STRINGS.some(VLS_COMPONENT_STRING => lines[curLine]?.startsWith(VLS_COMPONENT_STRING))
            const componentName = lines[curLine]?.match(/\.(\w+);?/)?.[1]

            prior.definitions =
                !isVLSComponent || !componentName
                    ? prior.definitions
                    : prior.definitions.filter(({ containerName }) => {
                          const isDefinitionInComponentsProperty = containerName === '__VLS_componentsOption'
                          const isGlobalComponent = containerName === 'GlobalComponents'

                          return !isDefinitionInComponentsProperty || isGlobalComponent
                      })
        }

        return prior
    }
}
