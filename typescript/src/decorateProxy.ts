import lodashGet from 'lodash.get'
import { getCompletionsAtPosition, PrevCompletionMap, PrevCompletionsAdditionalData } from './completionsAtPosition'
import { RequestOptionsTypes, TriggerCharacterCommand } from './ipcTypes'
import { getNavTreeItems } from './getPatchedNavTree'
import decorateCodeActions from './codeActions/decorateProxy'
import decorateSemanticDiagnostics from './semanticDiagnostics'
import decorateCodeFixes from './codeFixes'
import decorateReferences from './references'
import handleSpecialCommand from './specialCommands/handle'
import decorateDefinitions from './definitions'
import decorateDocumentHighlights from './documentHighlights'
import completionEntryDetails from './completionEntryDetails'
import { GetConfig, PluginCreateArg } from './types'
import decorateWorkspaceSymbolSearch from './workspaceSymbolSearch'
import decorateFormatFeatures from './decorateFormatFeatures'
import libDomPatching from './libDomPatching'
import decorateSignatureHelp from './decorateSignatureHelp'
import decorateFindRenameLocations from './decorateFindRenameLocations'
import decorateQuickInfoAtPosition from './decorateQuickInfoAtPosition'
import decorateEditsForFileRename from './decorateEditsForFileRename'

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
    { languageService, languageServiceHost }: PluginCreateArg,
    existingProxy: ts.LanguageService | undefined,
    config: { config: any },
    { pluginSpecificSyntaxServerConfigCheck = true }: { pluginSpecificSyntaxServerConfigCheck?: boolean } = {},
) => {
    const c: GetConfig = key => lodashGet(config.config, key)

    // Set up decorator object
    const proxy = getInitialProxy(languageService, existingProxy)

    let prevCompletionsMap: PrevCompletionMap
    let prevCompletionsAdditionalData: PrevCompletionsAdditionalData

    proxy.getCompletionsAtPosition = (fileName, position, options, formatOptions) => {
        if (options?.triggerCharacter && typeof options.triggerCharacter !== 'string') {
            return languageService.getCompletionsAtPosition(fileName, position, options)
        }
        const updateConfigCommand = 'updateConfig'
        if (options?.triggerCharacter?.startsWith(updateConfigCommand)) {
            config.config = JSON.parse(options.triggerCharacter.slice(updateConfigCommand.length))
            return { entries: [] }
        }

        const specialCommandResult = options?.triggerCharacter
            ? handleSpecialCommand(
                  fileName,
                  position,
                  options.triggerCharacter as TriggerCharacterCommand,
                  languageService,
                  config.config && c,
                  options,
                  formatOptions,
              )
            : null
        // handled specialCommand request
        if (specialCommandResult !== null) {
            return {
                entries: [],
                typescriptEssentialsResponse: specialCommandResult,
            } as any
        }

        prevCompletionsMap = {}
        const scriptSnapshot = languageServiceHost.getScriptSnapshot(fileName)
        const scriptKind = languageServiceHost.getScriptKind!(fileName)
        // have no idea in which cases its possible, but we can't work without it
        if (!scriptSnapshot) return
        const compilerOptions = languageServiceHost.getCompilationSettings()
        const result = getCompletionsAtPosition(fileName, position, options, c, languageService, scriptSnapshot, formatOptions, { scriptKind, compilerOptions })
        if (!result) return
        prevCompletionsMap = result.prevCompletionsMap
        prevCompletionsAdditionalData = result.prevCompletionsAdditionalData
        return result.completions
    }

    proxy.getCompletionEntryDetails = (...inputArgs) => completionEntryDetails(inputArgs, languageService, prevCompletionsMap, c, prevCompletionsAdditionalData)

    decorateEditsForFileRename(proxy, languageService, c)
    decorateCodeActions(proxy, languageService, languageServiceHost, c)
    decorateCodeFixes(proxy, languageService, languageServiceHost, c)
    decorateSemanticDiagnostics(proxy, languageService, languageServiceHost, c)
    decorateDefinitions(proxy, languageService, languageServiceHost, c)
    decorateReferences(proxy, languageService, c)
    decorateDocumentHighlights(proxy, languageService, c)
    decorateWorkspaceSymbolSearch(proxy, languageService, c, languageServiceHost)
    decorateFormatFeatures(proxy, languageService, languageServiceHost, c)
    decorateSignatureHelp(proxy, languageService, languageServiceHost, c)
    decorateFindRenameLocations(proxy, languageService, c)
    decorateQuickInfoAtPosition(proxy, languageService, languageServiceHost, c)

    libDomPatching(languageServiceHost, c)

    if (pluginSpecificSyntaxServerConfigCheck && !__WEB__) {
        // dedicated syntax server (which is enabled by default), which fires navtree doesn't seem to receive onConfigurationChanged
        // so we forced to communicate via fs
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const config = JSON.parse(ts.sys.readFile(require('path').join(__dirname, '../../plugin-config.json'), 'utf8') ?? '{}')
        proxy.getNavigationTree = fileName => {
            if (c('patchOutline') || config.patchOutline) return getNavTreeItems(languageService, languageServiceHost, fileName, config.outline)
            return languageService.getNavigationTree(fileName)
        }
    }

    languageService[thisPluginMarker] = true
    return proxy
}
