import { ConditionalPick } from 'type-fest'

import * as ts from 'typescript/lib/tsserverlibrary'
//@ts-expect-error
import type { Configuration } from '../../src/configurationType'
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Configuration = Configuration & { editorSuggestInsertModeReplace: boolean }
type LocalConfig = Configuration & { editorSuggestInsertModeReplace: boolean }
export type GetConfig = <T extends keyof LocalConfig>(key: T) => LocalConfig[T]

type LanguageServiceMethods = ConditionalPick<ts.LanguageService, (...args: any[]) => any>
export type LanguageServiceMethodWithConfig<T extends keyof LanguageServiceMethods> = (
    c: GetConfig,
    ...args: LanguageServiceMethods[T] extends (...args: infer P) => any ? P : never
) => LanguageServiceMethods[T] extends (...args: any[]) => infer R ? R : never

export type PluginCreateArg = Pick<ts.server.PluginCreateInfo, 'languageService' | 'languageServiceHost' | 'config'> &
    Partial<Pick<ts.server.PluginCreateInfo, 'serverHost'>>
