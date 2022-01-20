import ts_module from 'typescript/lib/tsserverlibrary'

export = function init({ typescript }: { typescript: typeof ts_module }) {
    return {
        create(info: ts.server.PluginCreateInfo) {
            info.session?.logError(new Error('test'), 'cmd')
            // Create new language service
        },
        onConfigurationChanged(config: any) {
            // Receive configuration changes sent from VS Code
        },
    }
}
