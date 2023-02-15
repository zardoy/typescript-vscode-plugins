beforeAll(() => {
    //@ts-ignore plugin expect it to set globallly
    globalThis.__WEB__ = false
})

import { createLanguageService } from '../src/dummyLanguageService'
import { Configuration } from '../src/types'
import { getDefaultConfigFunc } from './defaultSettings'

export const entrypoint = '/test.tsx'

export const sharedLanguageService = createLanguageService({ [entrypoint]: '' }, {}, entrypoint)

export const settingsOverride: Partial<Configuration> = {
    'arrayMethodsSnippets.enable': true,
    'codeActions.extractTypeInferName': true,
}
export const defaultConfigFunc = await getDefaultConfigFunc(settingsOverride)
