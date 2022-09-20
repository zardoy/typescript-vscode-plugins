export const triggerCharacterCommands = ['find-in-import', 'getPostfixes', 'nodeAtPosition'] as const
export type TriggerCharacterCommand = typeof triggerCharacterCommands[number]

export type NodeAtPositionResponse = {
    kindName: string
    start: number
    end: number
}

export type PostfixCompletion = {
    label: string
    // replacement: [startOffset: number, endOffset?: number]
    insertText: string
    // sortText?: number,
}
