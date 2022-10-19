import get from 'lodash.get'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
import type { Configuration } from '../../src/configurationType'
import _ from 'lodash'
import { GetConfig } from './types'
import { getCompletionsAtPosition, PrevCompletionMap } from './completionsAtPosition'
import { TriggerCharacterCommand } from './ipcTypes'
import { getNavTreeItems } from './getPatchedNavTree'
import decorateCodeActions from './codeActions/decorateProxy'
import decorateSemanticDiagnostics from './semanticDiagnostics'
import decorateCodeFixes from './codeFixes'
import decorateReferences from './references'
import handleSpecialCommand from './specialCommands/handle'
import decorateDefinitions from './definitions'
import decorateDocumentHighlights from './documentHighlights'
import completionEntryDetails from './completionEntryDetails'

const thisPluginMarker = Symbol('__essentialPluginsMarker__')

let _configuration: Configuration
const c: GetConfig = key => get(_configuration, key)

const decorateLanguageService = (info: ts.server.PluginCreateInfo, existingProxy?: ts.LanguageService) => {
    // Set up decorator object
    const proxy: ts.LanguageService = existingProxy ?? Object.create(null)

    for (const k of Object.keys(info.languageService)) {
        const x = info.languageService[k]!
        // @ts-expect-error - JS runtime trickery which is tricky to type tersely
        proxy[k] = (...args: Array<Record<string, unknown>>) => x.apply(info.languageService, args)
    }

    const { languageService } = info

    let prevCompletionsMap: PrevCompletionMap
    // eslint-disable-next-line complexity
    proxy.getCompletionsAtPosition = (fileName, position, options) => {
        const updateConfigCommand = 'updateConfig'
        if (options?.triggerCharacter?.startsWith(updateConfigCommand)) {
            _configuration = JSON.parse(options.triggerCharacter.slice(updateConfigCommand.length))
            return { entries: [] }
        }
        const specialCommandResult = options?.triggerCharacter
            ? handleSpecialCommand(info, fileName, position, options.triggerCharacter as TriggerCharacterCommand, _configuration)
            : undefined
        // handled specialCommand request
        if (specialCommandResult !== undefined) return specialCommandResult as any
        prevCompletionsMap = {}
        const scriptSnapshot = info.project.getScriptSnapshot(fileName)
        // have no idea in which cases its possible, but we can't work without it
        if (!scriptSnapshot) return
        const result = getCompletionsAtPosition(fileName, position, options, c, info.languageService, scriptSnapshot, ts)
        if (!result) return
        prevCompletionsMap = result.prevCompletionsMap
        return result.completions
    }

    proxy.getCompletionEntryDetails = (fileName, position, entryName, formatOptions, source, preferences, data) => {
        if (fileName === 'disposeLanguageService') {
            process.exit(1)
            return
        }
        const program = languageService.getProgram()
        const sourceFile = program?.getSourceFile(fileName)
        if (!program || !sourceFile) return
        const { documentationOverride } = prevCompletionsMap[entryName] ?? {}
        if (documentationOverride) {
            return {
                name: entryName,
                kind: ts.ScriptElementKind.alias,
                kindModifiers: '',
                displayParts: typeof documentationOverride === 'string' ? [{ kind: 'text', text: documentationOverride }] : documentationOverride,
            }
        }
        const prior = languageService.getCompletionEntryDetails(
            fileName,
            position,
            prevCompletionsMap[entryName]?.originalName || entryName,
            formatOptions,
            source,
            preferences,
            data,
        )
        if (!prior) return
        return completionEntryDetails(languageService, c, fileName, position, sourceFile, prior)
    }

    decorateCodeActions(proxy, info.languageService, c)
    decorateCodeFixes(proxy, info.languageService, c)
    decorateSemanticDiagnostics(proxy, info, c)
    decorateDefinitions(proxy, info, c)
    decorateReferences(proxy, info.languageService, c)
    decorateDocumentHighlights(proxy, info.languageService, c)

    if (!__WEB__) {
        // dedicated syntax server (which is enabled by default), which fires navtree doesn't seem to receive onConfigurationChanged
        // so we forced to communicate via fs
        const config = JSON.parse(ts.sys.readFile(require('path').join(__dirname, '../../plugin-config.json'), 'utf8') ?? '{}')
        proxy.getNavigationTree = fileName => {
            if (c('patchOutline') || config.patchOutline) return getNavTreeItems(ts, info, fileName)
            return info.languageService.getNavigationTree(fileName)
        }
    }

    info.languageService[thisPluginMarker] = true
    return proxy
}

const updateConfigListeners: Array<() => void> = []

const plugin: ts.server.PluginModuleFactory = ({ typescript }) => {
    ts = typescript
    return {
        create(info) {
            // receive fresh config
            _configuration = info.config
            console.log('receive config', JSON.stringify(_configuration))
            if (info.languageService[thisPluginMarker]) return info.languageService
            try {
                info.languageService.getCompletionEntryDetails('disposeLanguageService', 0, '', undefined, undefined, undefined, undefined)
            } catch {}

            const proxy = decorateLanguageService(info, undefined)

            let prevPluginEnabledSetting = _configuration.enablePlugin
            updateConfigListeners.push(() => {
                if (prevPluginEnabledSetting && !_configuration.enablePlugin) {
                    // plugin got disabled, restore original languageService methods
                    for (const key of Object.keys(proxy)) {
                        //@ts-expect-error
                        proxy[key] = (...args: Array<Record<string, unknown>>) => info.languageService[key].apply(info.languageService, args)
                    }
                } else if (!prevPluginEnabledSetting && _configuration.enablePlugin) {
                    // plugin got enabled
                    decorateLanguageService(info, proxy)
                }

                prevPluginEnabledSetting = _configuration.enablePlugin
            })

            return proxy
        },
        onConfigurationChanged(config) {
            console.log('update config', JSON.stringify(config))
            _configuration = config
            for (const updateConfigListener of updateConfigListeners) {
                updateConfigListener()
            }
        },
    }
}

//@ts-ignore
export = plugin
