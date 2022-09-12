import { readPackageJsonFile } from 'typed-jsonfile'

export const getDefaultConfig = async () => {
    let configProps
    try {
        configProps = ((await readPackageJsonFile('./out/package.json')) as any).contributes.configuration.properties
    } catch (err) {
        throw new Error('Run vscode-framework build before running tests!')
    }
    return Object.fromEntries(
        Object.entries(configProps as Record<string, any>).map(([setting, { default: defaultValue }]) => {
            const settingWithoutPrefix = setting.split('.').slice(1).join('.')
            if (defaultValue === undefined) throw new Error(`${settingWithoutPrefix} doesn't have default value!`)
            return [settingWithoutPrefix, defaultValue]
        }),
    )
}

export const getDefaultConfigFunc = async () => {
    const defaultConfig = await getDefaultConfig()
    return (config: string) => defaultConfig[config]
}
