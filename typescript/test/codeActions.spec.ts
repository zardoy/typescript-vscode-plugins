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
    test('Should convert `new` Expression', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            const /*t*/something/*t*/ = new Foo().something;
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'Add Destruct',
            newContent: /* ts */ `
            const { something } = new Foo();
        `,
        })
    })
    test('Should convert `await` Expression', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            const /*t*/something/*t*/ = (await aPromise()).something;
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'Add Destruct',
            newContent: /* ts */ `
            const { something } = (await aPromise());
        `,
        })
    })
    test('Should destruct function params', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            function fn(/*t*/newVariable/*t*/) {
                const something = newVariable.bar + newVariable.foo
            }
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'Add Destruct',
            newContent: /* ts */ `
            function fn({ bar, foo }) {
                const something = bar + foo
            }
        `,
        })
    })
    test('Should work with name collisions', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            function fn(/*t*/newVariable/*t*/) {
                const bar = 4
                const foo = 5
                const something = newVariable.bar + newVariable.foo
            }
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'Add Destruct',
            newContent: /* ts */ `
            function fn({ bar: bar_1, foo: foo_1 }) {
                const bar = 4
                const foo = 5
                const something = bar_1 + foo_1
            }
        `,
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
    test('Should convert nested', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            const { something: { test: { /*t*/abc/*t*/ } } } = obj;
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
    test('Should convert destructured function params', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            function foo({ /*t*/bar, foo/*t*/ }) {
                const something = bar + foo
            }
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'From Destruct',
            newContent: /* ts */ `
            function foo(newVariable) {
                const something = newVariable.bar + newVariable.foo
            }
        `,
        })
    })
    test('Should work with renamed params', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            function fn({ bar: /*t*/bar_1/*t*/, foo: foo_1 }) {
                const something = bar_1 + foo_1
            }
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'From Destruct',
            newContent: /* ts */ `
            function fn(newVariable) {
                const something = newVariable.bar + newVariable.foo
            }
        `,
        })
    })
    test('Should work with name collisions', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            function fn({ /*t*/bar/*t*/, foo }) {
                const newVariable = 5
                const something = bar + foo
            };
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'From Destruct',
            newContent: /* ts */ `
            function fn(newVariable_1) {
                const newVariable = 5
                const something = newVariable_1.bar + newVariable_1.foo
            };
        `,
        })
    })
})
