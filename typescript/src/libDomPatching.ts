import { GetConfig } from './types'
import { patchMethod } from './utils'

export default (languageServiceHost: ts.LanguageServiceHost, c: GetConfig) => {
    if (!c('libDomPatching')) return
    patchMethod(languageServiceHost, 'getScriptSnapshot', oldMethod => fileName => {
        const scriptSnapshot = oldMethod(fileName)
        if (!fileName.endsWith('/node_modules/typescript/lib/lib.dom.d.ts') /*  && c('eventTypePatching.enable') */) {
            return scriptSnapshot
        }
        if (!scriptSnapshot) return
        let contents = scriptSnapshot.getText(0, scriptSnapshot.getLength())
        contents = contents
            // .replace(/(interface EventListener \{\n\s*\(evt: )Event(\): void;\n\})/, '$1CustomEvent$2')
            .replace('interface EventTarget {', 'interface EventTarget extends HTMLElement {')
            .replace('"change": Event;', '"change": Event & {currentTarget: HTMLInputElement, target: HTMLInputElement};')
            .replace('"change": Event;', '"change": Event & {currentTarget: HTMLInputElement, target: HTMLInputElement};')
            .replace('"input": Event;', '"input": Event & {currentTarget: HTMLInputElement, target: HTMLInputElement};')
        return ts.ScriptSnapshot.fromString(contents)
    })
}
