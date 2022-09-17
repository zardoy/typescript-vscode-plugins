export const triggerCharacterCommands = ['find-in-import', 'getPostfixes', 'check-configuration'] as const
export type TriggerCharacterCommand = typeof triggerCharacterCommands[number]

export type PostfixCompletion = {
    label: string
    // replacement: [startOffset: number, endOffset?: number]
    insertText: string
    // sortText?: number,
}
