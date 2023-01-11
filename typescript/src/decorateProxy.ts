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
import { GetConfig } from './types'
import lodashGet from 'lodash.get'

/** @internal */
export const thisPluginMarker = '__essentialPluginsMarker__'

export const getInitialProxy = (languageService: ts.LanguageService, proxy = Object.create(null)): ts.LanguageService => {
    for (const k of Object.keys(languageService)) {
        const x = languageService[k]!
        // @ts-expect-error - JS runtime trickery which is tricky to type tersely
        proxy[k] = (...args: Array<Record<string, unknown>>) => x.apply(languageService, args)
    }
    return proxy
}

export const decorateLanguageService = (
    info: ts.server.PluginCreateInfo,
    existingProxy: ts.LanguageService | undefined,
    config: { config: any },
    { pluginSpecificSyntaxServerConfigCheck = true }: { pluginSpecificSyntaxServerConfigCheck?: boolean } = {},
) => {
    const c: GetConfig = key => lodashGet(config.config, key)
    const { languageService, languageServiceHost } = info

    // Set up decorator object
    const proxy = getInitialProxy(languageService, existingProxy)

    let prevCompletionsMap: PrevCompletionMap
    // eslint-disable-next-line complexity
    proxy.getCompletionsAtPosition = (fileName, position, options, formatOptions) => {
        const updateConfigCommand = 'updateConfig'
        if (options?.triggerCharacter?.startsWith(updateConfigCommand)) {
            config.config = JSON.parse(options.triggerCharacter.slice(updateConfigCommand.length))
            return { entries: [] }
        }
        const specialCommandResult = options?.triggerCharacter
            ? handleSpecialCommand(
                  info,
                  fileName,
                  position,
                  options.triggerCharacter as TriggerCharacterCommand,
                  languageService,
                  config.config,
                  options,
                  formatOptions,
              )
            : undefined
        // handled specialCommand request
        if (specialCommandResult !== undefined) return specialCommandResult as any
        prevCompletionsMap = {}
        const scriptSnapshot = languageServiceHost.getScriptSnapshot(fileName)
        const scriptKind = languageServiceHost.getScriptKind!(fileName)
        // have no idea in which cases its possible, but we can't work without it
        if (!scriptSnapshot) return
        const result = getCompletionsAtPosition(fileName, position, options, c, languageService, scriptSnapshot, formatOptions, { scriptKind })
        if (!result) return
        prevCompletionsMap = result.prevCompletionsMap
        return result.completions
    }

    proxy.getCompletionEntryDetails = (fileName, position, entryName, formatOptions, source, preferences, data) => {
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

    decorateCodeActions(proxy, languageService, c)
    decorateCodeFixes(proxy, languageService, c, languageServiceHost)
    decorateSemanticDiagnostics(proxy, info, c)
    decorateDefinitions(proxy, info, c)
    decorateReferences(proxy, languageService, c)
    decorateDocumentHighlights(proxy, languageService, c)

    if (pluginSpecificSyntaxServerConfigCheck) {
        if (!__WEB__) {
            // dedicated syntax server (which is enabled by default), which fires navtree doesn't seem to receive onConfigurationChanged
            // so we forced to communicate via fs
            const config = JSON.parse(ts.sys.readFile(require('path').join(__dirname, '../../plugin-config.json'), 'utf8') ?? '{}')
            proxy.getNavigationTree = fileName => {
                if (c('patchOutline') || config.patchOutline) return getNavTreeItems(info, fileName)
                return languageService.getNavigationTree(fileName)
            }
        }
    }

    languageService[thisPluginMarker] = true
    return proxy
}