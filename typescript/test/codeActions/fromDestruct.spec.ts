import { fourslashLikeTester } from '../testing'

describe('From destructure', () => {
    describe('Basic cases', () => {
        test('Same variable and accessor name', () => {
            const initial = /* ts */ `
                const { /*t*/something/*t*/ } = obj
            `
            const expected = /* ts */ `
                const something = obj.something
            `
            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'From Destruct',
                newContent: expected,
            })
        })
        test('Different name', () => {
            const initial = /* ts */ `
                const { /*t*/something: test/*t*/ } = obj
            `
            const expected = /* ts */ `
                const test = obj.something
            `

            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'From Destruct',
                newContent: expected,
            })
        })
    })
    describe.todo('Works with types', () => {
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
    })
    test('Should convert nested', () => {
        const initial = /* ts */ `
            const { something: { test: { /*t*/abc/*t*/ } } } = obj;
        `
        const expected = /* ts */ `
            const abc = obj.something.test.abc;
        `

        const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

        codeAction(0, {
            refactorName: 'From Destruct',
            newContent: expected,
        })
    })
    test('Should convert destructured function params', () => {
        const initial = /* ts */ `
            function foo({ /*t*/bar, foo/*t*/ }) {
                const something = bar + foo
            }
        `
        const expected = /* ts */ `
            function foo(newVariable) {
                const something = newVariable.bar + newVariable.foo
            }
        `

        const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

        codeAction(0, {
            refactorName: 'From Destruct',
            newContent: expected,
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
    describe('Skip cases', () => {
        test('Should skip element access expression', () => {
            const initial = /* ts */ `
            const /*t*/object/*t*/ = { 
                foo: 1,
            }
            const foo = 'foo'
            object[foo]
        `
            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'From Destruct',
                newContent: null,
            })
        })
        test('Should skip direct param access', () => {
            const initial = /* ts */ `
            function setUser(/*t*/user/*t*/) {
                const foo = user.objectId
                const bar = user
            }        
        `
            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'From Destruct',
                newContent: null,
            })
        })
    })
})
