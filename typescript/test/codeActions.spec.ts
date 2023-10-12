import { fourslashLikeTester } from './testing'

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
describe('Add destructure', () => {
    test('Same variable and accessor name', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            const /*t*/something/*t*/ = obj.something
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'Add Destruct',
            newContent: /* ts */ `
            const { something } = obj
        `,
        })
    })
    test('Different name', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            const /*t*/test/*t*/ = obj.something
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'Add Destruct',
            newContent: /* ts */ `
            const { something: test } = obj
        `,
        })
    })
    test('Should preserve type', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            const /*t*/something/*t*/: number = anObject.something;
        `,
            undefined,
            { dedent: true },
        )

        const content = codeAction(
            0,
            {
                refactorName: 'Add Destruct',
            },
            {},
            { compareContent: true },
        )

        expect(content).toMatchInlineSnapshot(`
          "
              const { something }: {
                      something: number;
                  } = anObject;
          "
        `)
    })
    test('Should skip optional chain', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            const /*t*/something/*t*/ = aProperty?.something;
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'Add Destruct',
            newContent: null,
        })
    })
})

describe('From destructure', () => {
    test('Same variable and accessor name', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            const { /*t*/something/*t*/ } = obj
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'From Destruct',
            newContent: /* ts */ `
            const something = obj.something
        `,
        })
    })
    test('Different name', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            const { /*t*/something: test/*t*/ } = obj
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'From Destruct',
            newContent: /* ts */ `
            const test = obj.something
        `,
        })
    })
    test.todo('Should preserve type', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            const { /*t*/something/*t*/ }: { something: number } = anObject;
        `,
            undefined,
            { dedent: true },
        )

        const content = codeAction(
            0,
            {
                refactorName: 'From Destruct',
            },
            {},
            { compareContent: true },
        )

        expect(content).toMatchInlineSnapshot(`
          "
              const something: number = anObject.something;
          "
        `)
    })
    test('Should skip optional chain', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            const { /*t*/something/*t*/ } = aProperty?.something;
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'From Destruct',
            newContent: null,
        })
    })
    test('Nested', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            const { something: { test: { abc } } } = obj;
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'From Destruct',
            newContent: /* ts */ `
            const abc = obj.something.test.abc;
        `,
        })
    })
})

