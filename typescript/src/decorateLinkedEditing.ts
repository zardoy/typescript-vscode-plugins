import { GetConfig } from './types'

export default (proxy: ts.LanguageService, languageService: ts.LanguageService, languageServiceHost: ts.LanguageServiceHost, c: GetConfig) => {
    // patch JSX tag linked editing to improve performance (needed for great user experience)

    let lastLinkedEditingRangeRequest:
        | {
              pos: number
              fileName: string
              result: ts.LinkedEditingInfo
          }
        | undefined
    proxy.getLinkedEditingRangeAtPosition = (fileName, position) => {
        const scriptSnapshot = languageServiceHost.getScriptSnapshot(fileName)!
        const fileContent = scriptSnapshot.getText(0, scriptSnapshot.getLength())
        const lastChar = fileContent[position - 1]

        if (
            c('experiments.speedLinkedEditing') &&
            /[\w\d.-]/i.test(lastChar ?? '') &&
            lastLinkedEditingRangeRequest &&
            lastLinkedEditingRangeRequest.pos === position - 1 &&
            lastLinkedEditingRangeRequest.fileName === fileName
        ) {
            lastLinkedEditingRangeRequest.pos = position
            lastLinkedEditingRangeRequest.result.ranges[0]!.length++
            lastLinkedEditingRangeRequest.result.ranges[1]!.start++
            lastLinkedEditingRangeRequest.result.ranges[1]!.length++
            return lastLinkedEditingRangeRequest.result
        }
        lastLinkedEditingRangeRequest = undefined

        const prior = languageService.getLinkedEditingRangeAtPosition(fileName, position)
        if (!prior) return
        lastLinkedEditingRangeRequest = {
            pos: position,
            fileName,
            result: globalThis.structuredClone(prior),
        }
        return prior
    }
}
