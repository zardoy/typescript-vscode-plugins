import { ApplyExtendedCodeActionResult, ExtendedCodeAction } from './codeActions/getCodeActions'

export const passthroughExposedApiCommands = ['getNodePath', 'getSpanOfEnclosingComment', 'getNodeAtPosition'] as const

export const triggerCharacterCommands = [
    ...passthroughExposedApiCommands,
    'emmet-completions',
    'filterBySyntaxKind',
    'removeFunctionArgumentsTypesInSelection',
    'pickAndInsertFunctionArguments',
    'getRangeOfSpecialValue',
    'getTwoStepCodeActions',
    'twoStepCodeActionSecondStep',
    'getFixAllEdits',
    'acceptRenameWithParams',
    'getFullMethodSnippet',
    'getExtendedCodeActionEdits',
] as const

export type TriggerCharacterCommand = (typeof triggerCharacterCommands)[number]

export type NodeAtPositionResponse = {
    kindName: string
    start: number
    end: number
}

type TsRange = [number, number]

export type PickFunctionArgsType = [name: string, declaration: TsRange, args: [name: string, type: string][]]

export type GetSignatureInfoParameter = {
    name: string
    insertText: string
    isOptional: boolean
}

// OUTPUT
/**
 * @keysSuggestions TriggerCharacterCommand
 */
export type RequestResponseTypes = {
    removeFunctionArgumentsTypesInSelection: {
        ranges: TsRange[]
    }
    getRangeOfSpecialValue: {
        range: TsRange
    }
    pickAndInsertFunctionArguments: {
        functions: PickFunctionArgsType[]
    }
    filterBySyntaxKind: {
        nodesByKind: Record<string, Array<{ range: TsRange }>>
    }
    getTwoStepCodeActions: {
        turnArrayIntoObject?: {
            keysCount: Record<string, number>
            totalCount: number
            totalObjectCount: number
        }
        moveToExistingFile?: {}
        extendedCodeActions: ExtendedCodeAction[]
    }
    twoStepCodeActionSecondStep:
        | {
              edits: ts.TextChange[]
          }
        | {
              fileEdits: ts.FileTextChanges[]
              fileNames: string[]
          }
    turnArrayIntoObjectEdit: ts.TextChange[]
    getFixAllEdits: ts.TextChange[]
    getFullMethodSnippet: string[] | undefined
    getExtendedCodeActionEdits: ApplyExtendedCodeActionResult
}

// INPUT
export type RequestOptionsTypes = {
    removeFunctionArgumentsTypesInSelection: {
        endSelection: number
    }
    getTwoStepCodeActions: {
        range: [number, number]
    }
    twoStepCodeActionSecondStep: {
        range: [number, number]
        data:
            | {
                  name: 'turnArrayIntoObject'
                  selectedKeyName?: string
              }
            | {
                  name: 'moveToExistingFile'
              }
    }

    acceptRenameWithParams: {
        comments: boolean
        strings: boolean
        alias: boolean
    }
    getExtendedCodeActionEdits: {
        range: [number, number]
        applyCodeActionTitle: string
    }
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
