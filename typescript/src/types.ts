import { ConditionalPick } from 'type-fest'
//@ts-expect-error
import type { Configuration } from '../../src/configurationType'
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Configuration = Configuration
export type GetConfig = <T extends keyof Configuration>(key: T) => Configuration[T]
export type LanguageServiceMethodWithConfig<T extends keyof ConditionalPick<ts.LanguageService, (...args) => any>> = (
    c: GetConfig,
    ...args: Parameters<ts.LanguageService[T]>
) => ReturnType<ts.LanguageService[T]>
