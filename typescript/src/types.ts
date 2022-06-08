// eslint-disable-next-line @typescript-eslint/ban-ts-comme
//@ts-ignore
import type { Configuration } from '../../src/configurationType'
export type Configuration = Configuration
export type GetConfig = <T extends keyof Configuration>(key: T) => Configuration[T]
