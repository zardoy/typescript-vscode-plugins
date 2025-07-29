import { ConditionalPick } from 'type-fest'

//@ts-expect-error
import type { Configuration } from '../../src/configurationType'
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Configuration = Configuration & { editorSuggestInsertModeReplace: boolean }
type LocalConfig = Configuration & { editorSuggestInsertModeReplace: boolean }
export type GetConfig = <T extends keyof LocalConfig>(key: T) => LocalConfig[T]
export type PluginCreateArg = Pick<ts.server.PluginCreateInfo, 'languageService' | 'languageServiceHost' | 'config'> &
    Partial<Pick<ts.server.PluginCreateInfo, 'serverHost'>>
