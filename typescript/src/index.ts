import { decorateLanguageService, getInitialProxy, thisPluginMarker } from './decorateProxy'
import { Configuration, PluginCreateArg } from './types'

const _configObj = {
    config: undefined! as Configuration,
}

const updateConfigListeners: Array<() => void> = []

const plugin = ({ typescript }: Parameters<ts.server.PluginModuleFactory>[0]) => {
    // eslint-disable-next-line no-multi-assign
    ts = tsFull = typescript as any
    return {
        create(info: PluginCreateArg) {
            // receive fresh config
            _configObj.config = info.config
            console.log('receive config', JSON.stringify(_configObj.config))
            if (info.languageService[thisPluginMarker]) return info.languageService

            const proxy =
                _configObj.config.enablePlugin === false
                    ? getInitialProxy(info.languageService)
                    : decorateLanguageService(info, undefined, _configObj, _configObj.config?.['_additionalPluginOptions'])

            // #region watch enablePlugin setting
            let prevPluginEnabledSetting = _configObj.config.enablePlugin
            updateConfigListeners.push(() => {
                if ((prevPluginEnabledSetting === true || prevPluginEnabledSetting === undefined) && !_configObj.config.enablePlugin) {
                    // plugin got disabled, restore original languageService methods
                    // todo resetting doesn't work after tsconfig changes
                    getInitialProxy(info.languageService, proxy)
                } else if (prevPluginEnabledSetting === false && _configObj.config.enablePlugin) {
                    // plugin got enabled
                    decorateLanguageService(info, proxy, _configObj, _configObj.config?.['_additionalPluginOptions'])
                }

                prevPluginEnabledSetting = _configObj.config.enablePlugin
            })
            // #endregion

            return proxy
        },
        onConfigurationChanged(config) {
            console.log('update config', JSON.stringify(config))
            _configObj.config = config
            for (const updateConfigListener of updateConfigListeners) {
                updateConfigListener()
            }
        },
    }
}

plugin satisfies ts.server.PluginModuleFactory

//@ts-expect-error
export = plugin
