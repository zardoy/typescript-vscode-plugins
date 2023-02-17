import { getCancellationToken, isTs5, nodeModules } from './utils'
import { createLanguageService } from './dummyLanguageService'
import { getCannotFindCodes } from './utils/cannotFindCodes'
import { ensureArray } from '@zardoy/utils'

// used at testing only
declare const __TS_SEVER_PATH__: string | undefined

type AdditionalFeatures = Record<'arraysTuplesNumberedItems', boolean>

const getPatchedNavModule = (additionalFeatures: AdditionalFeatures): { getNavigationTree(...args) } => {
    // what is happening here: grabbing & patching NavigationBar module contents from actual running JS
    const tsServerPath = typeof __TS_SEVER_PATH__ !== 'undefined' ? __TS_SEVER_PATH__ : require.main!.filename
    // current lib/tsserver.js
    const mainScript = nodeModules!.fs.readFileSync(tsServerPath, 'utf8') as string
    type PatchData = {
        markerModuleStart: string
        skipStartMarker?: boolean
        markerModuleEnd: string /*  | RegExp */
        patches: PatchLocation[]
        returnModuleCode: string
    }
    type PatchLocation = {
        searchString: string | string[]
        linesOffset: number
        addString?: string
        removeLines?: number
        // transform?: (found: string, content: string, position: number) => [string?, string?]
    }
    const addChildrenRecursivelySwitchFirstCase = ['function addChildrenRecursively(node)', 'switch (node.kind)']

    const patchLocations: PatchLocation[] = [
        {
            searchString: addChildrenRecursivelySwitchFirstCase,
            linesOffset: 1,
            addString: /* js */ `
                case ts.SyntaxKind.JsxSelfClosingElement:
                    addLeafNode(node)
                    break;
                case ts.SyntaxKind.JsxElement:
                    startNode(node)
                    ts.forEachChild(node, addChildrenRecursively);
                    endNode()
                    break;`,
        },
        {
            searchString: 'case 262 /* SyntaxKind.TypeAliasDeclaration */',
            linesOffset: 3,
            // https://github.com/microsoft/TypeScript/pull/52558/
            addString: /* js */ `
                case ts.SyntaxKind.TypeAliasDeclaration:
                    addNodeWithRecursiveChild(node, node.type);
                    break;
            `,
        },
        {
            searchString: 'case 262 /* SyntaxKind.TypeAliasDeclaration */',
            linesOffset: 0,
            removeLines: 1,
        },
        // prettier-ignore
        ...additionalFeatures.arraysTuplesNumberedItems ? [{
            searchString: addChildrenRecursivelySwitchFirstCase,
            linesOffset: 1,
            addString: /* js */ `
                case ts.SyntaxKind.TupleType:
                case ts.SyntaxKind.ArrayLiteralExpression:
                    const { elements } = node;
                    for (const [i, element] of elements.entries()) {
                        addNodeWithRecursiveChild(element, element, ts.setTextRange(ts.factory.createIdentifier(i.toString()), element));
                    }
                    break;
            `,
        }] : [],
        {
            searchString: 'return "<unknown>";',
            linesOffset: -1,
            addString: /* js */ `
                case ts.SyntaxKind.JsxSelfClosingElement:
                    return getNameFromJsxTag(node);
                case ts.SyntaxKind.JsxElement:
                    return getNameFromJsxTag(node.openingElement);`,
        },
    ]

    const {
        markerModuleStart,
        markerModuleEnd,
        patches,
        returnModuleCode,
        skipStartMarker = false,
    }: PatchData = !isTs5()
        ? {
              markerModuleStart: 'var NavigationBar;',
              markerModuleEnd: '(ts.NavigationBar = {}));',
              patches: patchLocations,
              returnModuleCode: 'NavigationBar',
          }
        : {
              markerModuleStart: '// src/services/navigationBar.ts',
              skipStartMarker: true,
              markerModuleEnd: '// src/',
              patches: patchLocations,
              returnModuleCode: '{ getNavigationTree }',
          }

    const contentAfterModuleStart = mainScript.slice(mainScript.indexOf(markerModuleStart) + (skipStartMarker ? markerModuleStart.length : 0))
    const lines = contentAfterModuleStart.slice(0, contentAfterModuleStart.indexOf(markerModuleEnd) + markerModuleEnd.length).split(/\r?\n/)

    for (let { addString, linesOffset, searchString, removeLines = 0 } of patches) {
        let addTypeIndex = -1
        for (const search of ensureArray(searchString)) {
            const newIndexStart = addTypeIndex + 1
            addTypeIndex = newIndexStart + lines.slice(newIndexStart).findIndex(line => line.includes(search))
        }
        if (addTypeIndex !== -1) {
            lines.splice(addTypeIndex + linesOffset, removeLines, ...(addString ? [addString] : []))
        } else {
            console.error(`TS Essentials: Failed to patch NavBar module (outline): ${JSON.stringify(searchString)}`)
        }
    }
    const getModuleString = () => `module.exports = (ts, getNameFromJsxTag) => {\n${lines.join('\n')}\nreturn ${returnModuleCode}}`
    let moduleString = getModuleString()
    if (isTs5()) {
        const { languageService } = createLanguageService({
            'main.ts': moduleString,
        })
        const notFoundVariables = new Set<string>()
        const cannotFindCodes = getCannotFindCodes({ includeFromLib: false })
        for (const { code, messageText } of languageService.getSemanticDiagnostics('main.ts')) {
            if (!cannotFindCodes.includes(code)) continue
            const notFoundName = (typeof messageText === 'object' ? messageText.messageText : messageText).match(/^Cannot find name '(.+?)'./)?.[1]
            if (!notFoundName) continue
            notFoundVariables.add(notFoundName)
        }
        lines.unshift(`const {${[...notFoundVariables.keys()].join(', ')}} = ts;`)
        moduleString = getModuleString()
    }
    const getModule = nodeModules!.requireFromString(moduleString)
    const getNameFromJsxTag = (node: ts.JsxSelfClosingElement | ts.JsxOpeningElement) => {
        const {
            attributes: { properties },
        } = node
        const tagName = node.tagName.getText()
        const addDotAttrs = ['class', 'className']
        // TODO refactor to arr
        let idAdd = ''
        let classNameAdd = ''
        properties.forEach(attr => {
            if (!ts.isJsxAttribute(attr) || !attr.initializer) return
            const attrName = attr.name?.getText()
            if (!attrName) return
            if (addDotAttrs.includes(attrName)) {
                const textAdd = ts.isStringLiteral(attr.initializer) ? attr.initializer.text : ''
                for (let char of textAdd.split(' ')) {
                    if (char) classNameAdd += `.${char}`
                }
            } else if (attrName === 'id' && ts.isStringLiteral(attr.initializer)) {
                idAdd = `#${attr.initializer.text}`
            }
        })
        return tagName + classNameAdd + idAdd
    }
    return getModule(ts, getNameFromJsxTag)
}

let navModule: { getNavigationTree: any }

export const getNavTreeItems = (
    languageService: ts.LanguageService,
    languageServiceHost: ts.LanguageServiceHost,
    fileName: string,
    additionalFeatures: AdditionalFeatures,
) => {
    if (!navModule) navModule = getPatchedNavModule(additionalFeatures)
    const sourceFile =
        (languageService as import('typescript-full').LanguageService).getNonBoundSourceFile?.(fileName) ??
        languageService.getProgram()!.getSourceFile(fileName)
    if (!sourceFile) throw new Error('no sourceFile')

    return navModule.getNavigationTree(sourceFile, getCancellationToken(languageServiceHost))
}
