import { ConditionalPick } from 'type-fest'

//@ts-expect-error
import type { Configuration } from '../../src/configurationType'
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Configuration = Configuration & { editorSuggestInsertModeReplace: boolean }
type LocalConfig = Configuration & { editorSuggestInsertModeReplace: boolean }
export type GetConfig = <T extends keyof LocalConfig>(key: T) => LocalConfig[T]
export type LanguageServiceMethodWithConfig<T extends keyof ConditionalPick<ts.LanguageService, (...args) => any>> = (
    c: GetConfig,
    ...args: Parameters<ts.LanguageService[T]>
) => ReturnType<ts.LanguageService[T]>

export type PluginCreateArg = Pick<ts.server.PluginCreateInfo, 'languageService' | 'languageServiceHost' | 'config'> &
    Partial<Pick<ts.server.PluginCreateInfo, 'serverHost'>>
