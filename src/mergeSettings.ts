import * as vscode from 'vscode'
import lodash from 'lodash'
import { getExtensionContributionsPrefix } from 'vscode-framework'
import { Configuration } from './configurationType'

const settingsToIgnore = [] as Array<keyof Configuration>

export const mergeSettingsFromScopes = (
    settings: Record<string, any>,
    language: string,
    packageJson: { contributes: { configuration: { properties: Record<string, any> } } },
) => {
    const workspaceConfiguration = vscode.workspace.getConfiguration(process.env.IDS_PREFIX, { languageId: language })
    const {
        contributes: {
            configuration: { properties },
        },
    } = packageJson
    for (const [fullKey, item] of Object.entries(properties)) {
        const key = fullKey.slice(getExtensionContributionsPrefix().length)
        const isObject = item.type === 'object'
        if ((!isObject && item.type !== 'array') || settingsToIgnore.includes(key as keyof Configuration)) {
            continue
        }

        const value = getConfigValueFromAllScopes(workspaceConfiguration, key as keyof Configuration, isObject ? 'object' : 'array')
        lodash.set(settings, key, value)
    }
}

const getConfigValueFromAllScopes = <T extends keyof Configuration>(
    workspaceConfiguration: vscode.WorkspaceConfiguration,
    configKey: T,
    type: 'array' | 'object',
): Configuration[T] => {
    const values = { ...workspaceConfiguration.inspect<any[]>(configKey)! }
    const userValueKeys = Object.keys(values).filter(key => key.endsWith('Value') && !key.startsWith('default'))
    for (const key of userValueKeys) {
        if (values[key] !== undefined) {
            continue
        }

        values[key] = type === 'array' ? [] : {}
    }

    return type === 'array' ? userValueKeys.flatMap(key => values[key]) : Object.assign({}, ...userValueKeys.map(key => values[key]))
}
