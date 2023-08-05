import * as vscode from 'vscode'
import { getExtensionCommandId } from 'vscode-framework'
import { passthroughExposedApiCommands, TriggerCharacterCommand } from '../typescript/src/ipcTypes'
import { sendCommand } from './sendCommand'

type RequestOptions = Partial<{
    /**
     * Should be rarely overrided, this document must be part of opened project
     * If specificed, offset or position must be provided too
     */
    document: vscode.TextDocument
    offset: number
    relativeOffset: number
    position: vscode.Position
}>

/** @unique */
const cacheableCommands: Set<(typeof passthroughExposedApiCommands)[number]> = new Set(['getNodePath', 'getSpanOfEnclosingComment', 'getNodeAtPosition'])
const operationsCache = new Map<string, { key: string; data; time?: number }>()
export const sharedApiRequest = async (type: TriggerCharacterCommand, { offset, relativeOffset = 0, document, position }: RequestOptions) => {
    if (position && offset) throw new Error('Only position or offset parameter can be provided')
    if (document && !offset && !position) throw new Error('When custom document is provided, offset or position must be provided')

    const { activeTextEditor } = vscode.window
    document ??= activeTextEditor?.document
    if (!document) return
    if (!position) offset ??= document.offsetAt(activeTextEditor!.selection.active) + relativeOffset
    const requestOffset = offset ?? document.offsetAt(position!)
    const requestPos = position ?? document.positionAt(offset!)
    const getData = async () => sendCommand(type, { document: document!, position: requestPos, inputOptions: {} })
    const CACHE_UNDEFINED_TIMEOUT = 1000
    if (cacheableCommands.has(type as any)) {
        const cacheEntry = operationsCache.get(type)
        const operationKey = `${document.uri.toString()}:${document.version}:${requestOffset}`
        if (cacheEntry?.key === operationKey && cacheEntry?.time && Date.now() - cacheEntry.time < CACHE_UNDEFINED_TIMEOUT) {
            return cacheEntry.data
        }

        const data = getData()
        // intentionally storing data only per one offset because it was created for this specific case:
        // extension 1 completion provider requests API data
        // at the same time:
        // extension 2 completion provider requests API data at the same document and position
        // and so on
        operationsCache.set(type, { key: operationKey, data, time: data === undefined ? Date.now() : undefined })
        if (type === 'getNodePath') {
            operationsCache.set('getNodeAtPosition', { key: operationKey, data: data.then((path: any) => path?.[path.length - 1]) })
        }

        return data
    }

    return getData()
}

export default () => {
    for (const cmd of passthroughExposedApiCommands) {
        vscode.commands.registerCommand(getExtensionCommandId(cmd as never), async (options: RequestOptions = {}) => sharedApiRequest(cmd, options))
    }
}
