# VS CODE Refactor Extensions Comparing

All of these extensions are free to use and can be used offline.

| Extension                                                                                                       | Good number of actions | Actions quality                                                            | Performance Optimizations                           |
| --------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| [JS Refactor :: JS CodeFormer](https://marketplace.visualstudio.com/items?itemName=cmstead.jsrefactor)          | ✅                      | ❌ (Extension abandoned)                                                    | ?                                                   |
| [Abracadabra, refactor this!](https://marketplace.visualstudio.com/items?itemName=nicoespeon.abracadabra)       | ✅                      | ❌ Sometimes buggy, doesn't work with syntax errors, no TS types auto-infer | ❌ (Uses extension host, slow downs other extension) |
| [JS Refactoring Assistant (P42)](https://marketplace.visualstudio.com/items?itemName=p42ai.refactor)            | ✅                      | JS - ✅, TS - ❌ (You need to write types yourself)                          | ✅ (Dedicated language server)                       |
| [TypeScript Essential Plugins](https://marketplace.visualstudio.com/items?itemName=zardoy.ts-essential-plugins) | ❌                      | ✅? (Auto infers types, but missing a lot of tests)                         | ✅ (Best possible, reuses TS language server)        |
