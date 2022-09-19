import type tslib from 'typescript/lib/tsserverlibrary'
import requireFromString from 'require-from-string'

declare const __TS_SEVER_PATH__: string | undefined

const getPatchedNavModule = (ts: typeof tslib) => {
    const tsServerPath = typeof __TS_SEVER_PATH__ !== 'undefined' ? __TS_SEVER_PATH__ : require.main!.filename
    const mainScript = require('fs').readFileSync(tsServerPath, 'utf8') as string
    const startIdx = mainScript.indexOf('var NavigationBar;')
    const ph = '(ts.NavigationBar = {}));'
    const lines = mainScript.slice(startIdx, mainScript.indexOf(ph) + ph.length).split(/\r?\n/)
    const patchPlaces: {
        predicateString: string
        linesOffset: number
        addString?: string
        removeLines?: number
    }[] = [
        {
            predicateString: 'function addChildrenRecursively(node)',
            linesOffset: 7,
            addString: `
                case ts.SyntaxKind.JsxSelfClosingElement:
                    addLeafNode(node)
                    break;
                case ts.SyntaxKind.JsxElement:
                    startNode(node)
                    ts.forEachChild(node, addChildrenRecursively);
                    endNode()
                break`,
        },
        {
            predicateString: 'return "<unknown>";',
            linesOffset: -1,
            addString: `
                case ts.SyntaxKind.JsxSelfClosingElement:
                return getNameFromJsxTag(node);
                case ts.SyntaxKind.JsxElement:
                return getNameFromJsxTag(node.openingElement);`,
        },
    ]
    for (let { addString, linesOffset, predicateString, removeLines = 0 } of patchPlaces) {
        const addTypeIndex = lines.findIndex(line => line.includes(predicateString))
        if (addTypeIndex !== -1) {
            lines.splice(addTypeIndex + linesOffset, removeLines, ...(addString ? [addString] : []))
        }
    }
    const getModule = requireFromString('module.exports = (ts, getNameFromJsxTag) => {' + lines.join('\n') + 'return NavigationBar;}')
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

let navModule

export const getNavTreeItems = (ts: typeof tslib, info: ts.server.PluginCreateInfo, fileName: string) => {
    if (!navModule) navModule = getPatchedNavModule(ts)
    const program = info.languageService.getProgram()
    if (!program) throw new Error('no program')
    const sourceFile = program?.getSourceFile(fileName)
    if (!sourceFile) throw new Error('no sourceFile')

    const cancellationToken = info.languageServiceHost.getCompilerHost?.()?.getCancellationToken?.() ?? {
        isCancellationRequested: () => false,
        throwIfCancellationRequested: () => {},
    }
    return navModule.getNavigationTree(sourceFile, cancellationToken)
}
