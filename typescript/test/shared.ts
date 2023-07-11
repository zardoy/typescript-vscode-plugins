/* eslint-disable import/first */
beforeAll(() => {
    //@ts-expect-error plugin expect it to set globallly
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
    'methodSnippets.skip': 'no-skip',
    tupleHelpSignature: true,
}
export const defaultConfigFunc = await getDefaultConfigFunc(settingsOverride)

export const currentTestingContext = {
    markers: [] as number[],
}
