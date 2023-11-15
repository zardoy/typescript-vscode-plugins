import { fourslashLikeTester } from '../testing'

test('Split Declaration and Initialization', () => {
    const { codeAction } = fourslashLikeTester(
        /* ts */ `
            /*t*/const/*t*/ a = 1
        `,
        undefined,
        { dedent: true },
    )

    codeAction(0, {
        refactorName: 'Split Declaration and Initialization',
        newContent: /* ts */ `
            let a: number
            a = 1
        `,
    })
})
