import { matchParents } from '../../utils'
import { CodeAction } from '../getCodeActions'

export default {
    id: 'fixOppositeTagName',
    kind: 'quickfix',
    name: 'Fix opposite tag name',
    tryToApply(sourceFile, position, range, node) {
        const elem = matchParents(node, ['Identifier', 'JsxOpeningElement']) ?? matchParents(node, ['Identifier', 'JsxClosingElement'])
        if (!elem) return
        const tagNamesDiffers = elem.parent.openingElement.tagName.getText() !== elem.parent.closingElement.tagName.getText()
        if (tagNamesDiffers) {
            const isCurrentlyAtOpening = elem.parent.openingElement === elem
            const oppositeElem = isCurrentlyAtOpening ? elem.parent.closingElement.tagName : elem.parent.openingElement.tagName
            return [
                {
                    start: oppositeElem.getStart(),
                    length: oppositeElem.getWidth(),
                    newText: elem.tagName.getText(),
                },
            ]
        }
        return
    },
} satisfies CodeAction
