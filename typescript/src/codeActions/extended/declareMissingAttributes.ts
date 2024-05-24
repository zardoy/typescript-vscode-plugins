import { ExtendedCodeAction } from '../getCodeActions'

const errorCodes = [
    // ts.Diagnostics.Property_0_does_not_exist_on_type_1.code,
    // ts.Diagnostics.Property_0_does_not_exist_on_type_1_Did_you_mean_2.code,
    // ts.Diagnostics.Property_0_is_missing_in_type_1_but_required_in_type_2.code,
    // ts.Diagnostics.Type_0_is_missing_the_following_properties_from_type_1_Colon_2.code,
    // ts.Diagnostics.Type_0_is_missing_the_following_properties_from_type_1_Colon_2_and_3_more.code,
    // // ts.Diagnostics.Argument_of_type_0_is_not_assignable_to_parameter_of_type_1.code,
    // // ts.Diagnostics.Cannot_find_name_0.code,
    2339, 2551, 2741, 2739, 2740 /*  2345, 2304, */,
]

export default {
    codes: errorCodes,
    kind: 'quickfix',
    title: 'Declare missing attributes',
    tryToApply({ sourceFile, node, c, languageService, position, formatOptions, range }) {
        // todo maybe cache from prev request?
        if (!node) return
        const codeFixes = languageService.getCodeFixesAtPosition(
            sourceFile.fileName,
            node.getStart(),
            range?.end ?? node.getStart(),
            errorCodes,
            formatOptions ?? {},
            {},
        )
        const fix = codeFixes.find(codeFix => codeFix.fixName === 'fixMissingAttributes')
        if (fix && fix.changes[0]?.textChanges.length === 1) {
            const changes = fix.changes[0]!.textChanges
            let i = 1
            return {
                snippetEdits: [
                    {
                        newText: changes[0]!.newText.replaceAll('$', '\\$').replaceAll('={undefined}', () => `={$${i++}}`),
                        span: fix.changes[0]!.textChanges[0]!.span,
                    },
                ],
            }
        }
        return
    },
} as ExtendedCodeAction
