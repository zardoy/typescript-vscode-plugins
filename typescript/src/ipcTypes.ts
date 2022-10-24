export const passthroughExposedApiCommands = ['getNodePath', 'getSpanOfEnclosingComment', 'getNodeAtPosition'] as const

export const triggerCharacterCommands = [...passthroughExposedApiCommands, 'emmet-completions', 'getPostfixes'] as const

export type TriggerCharacterCommand = typeof triggerCharacterCommands[number]

export type NodeAtPositionResponse = {
    kindName: string
    start: number
    end: number
}

// export type EmmetResult = {
//     label: string
//     documentation: any
//     insertText: string
//     // from cursor position of course
//     rangeLength: number
// }[]

export type EmmetResult = {
    /** negative */
    emmetTextOffset: number
}

export type PostfixCompletion = {
    label: string
    // replacement: [startOffset: number, endOffset?: number]
    insertText: string
    // sortText?: number,
}
