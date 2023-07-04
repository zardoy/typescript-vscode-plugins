import { ConditionalPick } from 'type-fest'

type Tail<T> = T extends readonly [...any[], infer U] ? U : never
type GetIs<T> = T extends (elem: any) => elem is infer T ? T : never

type TSNodeIs = ConditionalPick<typeof ts, (node: ts.Node) => node is ts.Node>
type Comparisons = {
    [T in keyof TSNodeIs as T extends `is${infer U}` ? /* Uncapitalize<U> */ U : never]: GetIs<(typeof ts)[T & keyof typeof ts]>
}

export type MatchParentsType = <K extends keyof Comparisons, const T extends readonly [...K[]]>(
    node: ts.Node | undefined,
    treeToCompare: T,
) => Comparisons[Tail<T> & keyof Comparisons] | undefined
