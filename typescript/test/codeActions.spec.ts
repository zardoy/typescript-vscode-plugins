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
    describe('Should destruct function params', () => {
        const expected = /* ts */ `
            function fn({ bar, foo }) {
                const something = bar + foo
            }
        `
        test('Cursor position on param', () => {
            const cursorOnParam = /* ts */ `
            function fn(/*t*/newVariable/*t*/) {
                const something = newVariable.bar + newVariable.foo
            }
        `
            const { codeAction } = fourslashLikeTester(cursorOnParam, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: expected,
            })
        })
        test.skip('Cursor position on accessor', () => {
            const cursorOnParam = /* ts */ `
            function fn(newVariable) {
                const something = newVariable./*t*/bar/*t*/ + newVariable.foo
            }
        `
            const { codeAction } = fourslashLikeTester(cursorOnParam, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: expected,
            })
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
            function fn({ bar: _bar, foo: _foo }) {
                const bar = 4
                const foo = 5
                const something = _bar + _foo
            }
        `,
        })
    })
    describe('Works with inline object', () => {
        const expected = /* ts */ `
            const { foo } = {
                foo: 1,
            }
            foo
        `
        test('Cursor position on object variable declaration', () => {
            const cursorOnObjVarDecl = /* ts */ `
            const /*t*/a/*t*/ = {
                foo: 1,
            }
            a.foo
        `
            const { codeAction } = fourslashLikeTester(cursorOnObjVarDecl, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: expected,
            })
        })
        test.skip('Cursor position on accessor', () => {
            const cursorOnAccessor = /* ts */ `
            const a = {
                foo: 1,
            }
            
            a./*t*/foo/*t*/
        `
            const { codeAction } = fourslashLikeTester(cursorOnAccessor, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: expected,
            })
        })
    })
    describe('Handles reserved words', () => {
        test('Makes unique identifier for reserved word', () => {
            const initial = /* ts */ `
                const /*t*/a/*t*/ = { 
                    class: 1,
                }
                a.class
            `
            const expected = /* ts */ `
                const { class: _class } = { 
                    class: 1,
                }
                _class
            `
            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: expected,
            })
        })
    })
    describe('Should work with index access', () => {
        test('Adds destructure when index access content is string', () => {
            const initial = /* ts */ `
            const /*t*/newVariable/*t*/ = { 
                foo: 1,
            }
            newVariable['foo']
        `
            const expected = /* ts */ `
            const { foo } = { 
                foo: 1,
            }
            foo
        `
            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: expected,
            })
        })
        test('Should add rest elements to destructure when index access content is expression', () => {
            const initial = /* ts */ `
            const /*t*/object/*t*/ = { 
                foo: 1,
                bar: 2,
            }
            const foo = 'foo'
            object[foo]
            object.bar
        `
            const expected = /* ts */ `
            const { bar, ...newVariable } = { 
                foo: 1,
                bar: 2,
            }
            const foo = 'foo'
            newVariable[foo]
            bar
        `
            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: expected,
            })
        })
    })
    describe('Should handle `this` keyword destructure', () => {
        test('Basic `this` destructure', () => {
            const initial = /* ts */ `
                const obj = {
                    foo() {
                        const a = /*t*/this.a/*t*/
                    }
                }
            `
            const expected = /* ts */ `
                const obj = {
                    foo() {
                        const { a } = this
                    }
                }
            `
            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: expected,
            })
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
    test('Should work with name collisions in nested manual blocks', () => {
        const { codeAction } = fourslashLikeTester(
            /* ts */ `
            function fn({ /*t*/bar/*t*/, foo }) {
                {
                    const newVariable = 5
                    const something = bar + foo
                }
            };
        `,
            undefined,
            { dedent: true },
        )

        codeAction(0, {
            refactorName: 'From Destruct',
            newContent: /* ts */ `
            function fn(newVariable_1) {
                {
                    const newVariable = 5
                    const something = newVariable_1.bar + newVariable_1.foo
                }
            };
        `,
        })
    })
    test('Should work with rest elements destructure', () => {
        const initial = /* ts */ `
            const { /*t*/foo/*t*/, ...a } = {
                bar: 1,
                foo: 2,
            } 
            
            a.bar
            foo
        `
        const expected = /* ts */ `
            const newVariable = {
                bar: 1,
                foo: 2,
            } 
            
            newVariable.bar
            newVariable.foo
        `
        const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

        codeAction(0, {
            refactorName: 'From Destruct',
            newContent: expected,
        })
    })
    describe('Works with inline object', () => {
        test('Destructured only one property', () => {
            const initial = /* ts*/ `
                const { /*t*/foo/*t*/ } = {
                    foo: 1,
                }
            `
            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            const newContent = codeAction(
                0,
                {
                    refactorName: 'From Destruct',
                },
                {},
                { compareContent: true },
            )
            expect(newContent).toMatchInlineSnapshot(`
              "
                  const foo = {
                  foo: 1,
              }.foo
              "
            `)
        })
        test('Destructured two or more properties', () => {
            const initial = /* ts*/ `
                const { /*t*/foo/*t*/, bar } = {
                    foo: 1,
                    bar: 2,
                }
                foo;
                bar;
            `
            const expected = /* ts*/ `
                const newVariable = {
                    foo: 1,
                    bar: 2,
                }
                newVariable.foo;
                newVariable.bar;
            `
            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'From Destruct',
                newContent: expected,
            })
        })
    })
})
