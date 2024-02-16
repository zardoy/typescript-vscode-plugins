import { fourslashLikeTester } from '../testing'

describe('Add destructure', () => {
    describe('Basic cases', () => {
        test('Same variable and accessor name', () => {
            const initial = /* ts */ `
              const /*t*/something/*t*/ = obj.something
            `
            const expected = /* ts */ `
              const { something } = obj
            `
            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: expected,
            })
        })
        test('Different name', () => {
            const initial = /* ts */ `
              const /*t*/test/*t*/ = obj.something
            `
            const expected = /* ts */ `
              const { something: test } = obj
            `

            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: expected,
            })
        })
        test('Multiple same prop extractions', () => {
            const initial = /* ts */ `
              const /*t*/props/*t*/ = {
                source: {
                  type: Object,
                  required: true,
                },
              };
              const test = props.source;
              const test2 = props.source;
              const test3 = props.source;
            `
            const expected = /* ts */ `
              const { source } = {
                source: {
                  type: Object,
                  required: true,
                },
              };
              const test = source;
              const test2 = source;
              const test3 = source;
            `

            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: expected,
            })
        })
    })
    describe('Works with types', () => {
        test('Should preserve type', () => {
            const initial = /* ts */ `
              const /*t*/something/*t*/: number = anObject.something;
            `
            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

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
    test('Should handle shorthandAssignment', () => {
        const initial = /* ts */ `
          const /*t*/newVariable/*t*/ = foo

          const obj = {
              tag: newVariable.tag,
          }
        `
        const expected = /* ts */ `
          const { tag } = foo

          const obj = {
              tag,
          }
        `

        const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

        codeAction(0, {
            refactorName: 'Add Destruct',
            newContent: expected,
        })
    })
    test('Should destruct function params', () => {
        const initial = /* ts */ `
          function fn(/*t*/newVariable/*t*/) {
              const something = newVariable.bar + newVariable.foo
          }
        `
        const expected = /* ts */ `
          function fn({ bar, foo }) {
              const something = bar + foo
          }
        `
        const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

        codeAction(0, {
            refactorName: 'Add Destruct',
            newContent: expected,
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
    describe('Should destruct param call expression param', () => {
        test('Should skip if trying to destruct call expression', () => {
            const initial = /* ts */ `
              const /*t*/newVariable/*t*/ = { test: 1}

              const obj = {
                  tag: foo.map(newVariable.test),
              }
            `
            const expected = /* ts */ `
              const { test } = { test: 1}

              const obj = {
                  tag: foo.map(test),
              }
            `

            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: expected,
            })
        })
    })

    describe('Skip cases', () => {
        test('Should skip if trying to destruct expression of call expression', () => {
            const initial = /* ts */ `
              const /*t*/newVariable/*t*/ = foo

              const obj = {
                  tag: newVariable.map(() => 10),
              }
            `

            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: null,
            })
        })
        test('Should skip if cursor is on accessor', () => {
            const cursorOnAccessor = /* ts */ `
              const a = {
                  foo: 1,
              }
              
              a./*t*/foo/*t*/
            `
            const { codeAction } = fourslashLikeTester(cursorOnAccessor, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: null,
            })
        })
        test('Should skip optional chain', () => {
            const initial = /* ts */ `
              const /*t*/something/*t*/ = aProperty?.something;
            `

            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: null,
            })
        })
        test('Should skip typeof operator', () => {
            const initial = /* ts */ `
                const /*t*/obj/*t*/ = {
                    test: 1,
                }
                obj.test
                
                type foo = typeof obj;
            `

            const { codeAction } = fourslashLikeTester(initial, undefined, { dedent: true })

            codeAction(0, {
                refactorName: 'Add Destruct',
                newContent: null,
            })
        })
    })
})
