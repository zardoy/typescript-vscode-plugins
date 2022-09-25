import { readPackageJsonFile } from 'typed-jsonfile'
import { Configuration } from '../src/types'

export const getDefaultConfig = async (skipKeys: string[]) => {
    let configProps
    try {
        configProps = ((await readPackageJsonFile('./out/package.json')) as any).contributes.configuration.properties
    } catch (err) {
        throw new Error('Run vscode-framework build before running tests!')
    }
    return Object.fromEntries(
        Object.entries(configProps as Record<string, any>)
            .map(([setting, { default: defaultValue }]) => {
                const settingWithoutPrefix = setting.split('.').slice(1).join('.')
                if (skipKeys.includes(settingWithoutPrefix)) return undefined!
                if (defaultValue === undefined) throw new Error(`${settingWithoutPrefix} doesn't have default value!`)
                return [settingWithoutPrefix, defaultValue]
            })
            .filter(Boolean),
    )
}

export const getDefaultConfigFunc = async (settingsOverrides: Partial<Configuration> = {}) => {
    const defaultConfig = await getDefaultConfig(Object.keys(settingsOverrides))
    return (setting: string) => settingsOverrides[setting] ?? defaultConfig[setting]
}
