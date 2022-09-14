import type tslib from 'typescript/lib/tsserverlibrary'

class DisplayPartKind {
    public static readonly functionName = 'functionName'
    public static readonly methodName = 'methodName'
    public static readonly parameterName = 'parameterName'
    public static readonly propertyName = 'propertyName'
    public static readonly punctuation = 'punctuation'
    public static readonly text = 'text'
}

export function getParameterListParts(displayParts: ReadonlyArray<tslib.SymbolDisplayPart>) {
    const parts: tslib.SymbolDisplayPart[] = []
    let gotMethodHit = false
    let isInMethod = false
    let hasOptionalParameters = false
    let parenCount = 0
    let braceCount = 0

    outer: for (let i = 0; i < displayParts.length; ++i) {
        const part = displayParts[i]!
        switch (part.kind) {
            case DisplayPartKind.methodName:
            case DisplayPartKind.functionName:
            case 'aliasName':
            case DisplayPartKind.text:
            case DisplayPartKind.propertyName:
                if (parenCount === 0 && braceCount === 0) {
                    isInMethod = true
                    gotMethodHit = true
                }
                break

            case DisplayPartKind.parameterName:
                if (parenCount === 1 && braceCount === 0 && isInMethod) {
                    // Only take top level paren names
                    const next = displayParts[i + 1]
                    // Skip optional parameters
                    const nameIsFollowedByOptionalIndicator = next && next.text === '?'
                    // Skip this parameter
                    const nameIsThis = part.text === 'this'
                    if (!nameIsFollowedByOptionalIndicator && !nameIsThis) {
                        parts.push(part)
                    }
                    hasOptionalParameters = hasOptionalParameters || nameIsFollowedByOptionalIndicator!
                }
                break

            case DisplayPartKind.punctuation:
                if (part.text === '(') {
                    ++parenCount
                } else if (part.text === ')') {
                    --parenCount
                    if (parenCount <= 0 && isInMethod) {
                        break outer
                    }
                } else if (part.text === '...' && parenCount === 1) {
                    // Found rest parmeter. Do not fill in any further arguments
                    hasOptionalParameters = true
                    break outer
                } else if (part.text === '{') {
                    ++braceCount
                } else if (part.text === '}') {
                    --braceCount
                }
                break
        }
    }

    return { hasOptionalParameters, parts, gotMethodHit }
}
