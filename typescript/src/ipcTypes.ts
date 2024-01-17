// should-not contain other typescript/* imports that use globals as is imported in extension code (src/)

export const passthroughExposedApiCommands = ['getNodePath', 'getSpanOfEnclosingComment', 'getNodeAtPosition', 'getFullType'] as const

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
    'getExtendedCodeActionEdits',
    'getLastResolvedCompletion',
    'getArgumentReferencesFromCurrentParameter',
    'performanceInfo',
    'getMigrateToImportsEdits',
] as const

export type TriggerCharacterCommand = (typeof triggerCharacterCommands)[number]

export type NodeAtPositionResponse = {
    kindName: string
    start: number
    end: number
}

type TsRange = [number, number]

export type PickFunctionArgsType = [name: string, declaration: TsRange, args: Array<[name: string, type: string]>]

export type GetSignatureInfoParameter = {
    name: string
    insertText: string
    isOptional: boolean
}

export type IpcExtendedCodeAction = {
    title: string
    kind: string
    codes?: number[]
}

// INPUT
export type RequestInputTypes = {
    removeFunctionArgumentsTypesInSelection: {
        endSelection: number
    }
    getTwoStepCodeActions: {
        range: [number, number]
        diagnostics: number[]
    }
    twoStepCodeActionSecondStep: {
        range: [number, number]
        data: {
            name: 'turnArrayIntoObject'
            selectedKeyName?: string
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

// OUTPUT
/**
 * @keysSuggestions TriggerCharacterCommand
 */
export type RequestOutputTypes = {
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
        extendedCodeActions: IpcExtendedCodeAction[]
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
    getExtendedCodeActionEdits: ApplyExtendedCodeActionResult
    getLastResolvedCompletion: {
        name: string
        range?: TsRange
    }
    getFullType: {
        text: string
    }
    getArgumentReferencesFromCurrentParameter: Array<{ line: number; character: number; filename: string }>
    'emmet-completions': EmmetResult
    getMigrateToImportsEdits: ts.TextChange[]
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

export type ApplyExtendedCodeActionResult = {
    edits: ts.TextChange[]
    snippetEdits: ts.TextChange[]
}
