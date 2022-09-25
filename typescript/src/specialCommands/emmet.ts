import { EmmetResult } from '../ipcTypes'
import prepareTextForEmmet from './prepareTextForEmmet'

export default (
    fileName: string,
    nodeLeft: ts.Node,
    sourceFile: ts.SourceFile,
    position: number,
    languageService: ts.LanguageService /* , c: GetConfig */,
): EmmetResult | undefined => {
    if (__WEB__) return
    const sendToEmmet = prepareTextForEmmet(fileName, nodeLeft, sourceFile, position, languageService)
    if (sendToEmmet === false) return
    return {
        emmetTextOffset: -sendToEmmet.length || 0,
    }
    // replacementSpan: { start: position - 5, length: 5 },
}
