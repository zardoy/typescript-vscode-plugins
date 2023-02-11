import * as vscode from 'vscode'
import lodash from 'lodash'
import { Configuration } from './configurationType'

const settingsToIgnore = [] as Array<keyof Configuration>

export const mergeSettingsFromScopes = (
    settings: Record<string, any>,
    language: string,
    packageJson: { contributes: { configuration: { properties: Record<string, any> } } },
) => {
    const {
        contributes: {
            configuration: { properties },
        },
    } = packageJson
    for (const [key, item] of Object.entries(properties)) {
        const isObject = item.type !== 'object'
        if ((isObject && item.type !== 'array') || settingsToIgnore.includes(key as keyof Configuration)) {
            continue
        }

        const value = getConfigValueFromAllScopes(key as keyof Configuration, language, isObject ? 'object' : 'array')
        lodash.set(settings, key, value)
    }
}

const getConfigValueFromAllScopes = <T extends keyof Configuration>(configKey: T, language: string, type: 'array' | 'object'): Configuration[T] => {
    const values = { ...vscode.workspace.getConfiguration(process.env.IDS_PREFIX, { languageId: language }).inspect<any[]>(configKey)! }
    const userValueKeys = Object.keys(values).filter(key => key.endsWith('Value') && !key.startsWith('default'))
    console.log(userValueKeys)
    for (const key of userValueKeys) {
        if (values[key] !== undefined) {
            continue
        }

        values[key] = type === 'array' ? [] : {}
    }

    return type === 'array' ? userValueKeys.flatMap(key => values[key]) : Object.assign({}, ...userValueKeys.map(key => values[key]))
}
