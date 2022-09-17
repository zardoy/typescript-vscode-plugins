import type tslib from 'typescript/lib/tsserverlibrary'

// not used for now
export default (info: tslib.server.PluginCreateInfo) => {
    // info.serverHost.readFile = fileName => {
    //     let contents = realReadFile(fileName)
    //     if (fileName.endsWith('/node_modules/typescript/lib/lib.dom.d.ts') && c('eventTypePatching.enable')) {
    //         contents = contents
    //             ?.replace('interface EventTarget {', 'interface EventTarget extends HTMLElement {')
    //             .replace('"change": Event;', '"change": Event & {currentTarget: HTMLInputElement, target: HTMLInputElement};')
    //             .replace('"change": Event;', '"change": Event & {currentTarget: HTMLInputElement, target: HTMLInputElement};')
    //             .replace('"input": Event;', '"input": Event & {currentTarget: HTMLInputElement, target: HTMLInputElement};')
    //     }
    //     return contents
    // }
}
