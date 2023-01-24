# TypeScript Essential Plugins

## Top Features

> Here React experience hits different!

### Special Commands & Actions

See [special commands list](#special-commands-list) ans [code actions list](#contributed-code-actions)

### JSX Outline

(*disabled by default*) Enable with `tsEssentialPlugins.patchOutline`

Add JSX elements to outline. It also makes sticky scroll works with your tags!

Super recommended for react. Fragments are not rendered.

Also is not supported in the web.

## **Completions Built Different**

90% work done in this extension highly improves completions experience!

### Method Snippets

(*enabled by default*)

Expands arrow callbacks with signature snippet with adding additional undo stack!

Example:

```ts
const callback = (arg) => {}
callback -> callback(arg)
```

### Strict Emmet

(*enabled by default*) when react langs are in `emmet.excludeLanguages`

Emmet that is active **only** inside JSX tags!

You can force enable this by using `Enable Strict Emmet in JSX` command.

*Why?* Issues it fixes: [query](https://github.com/microsoft/vscode/issues?q=sort%3Aupdated-desc+51537+150671+142978+119736).

#### Optional Emmet Features

- cleanup suggestions (can be enabled `jsxEmmet.modernize`)
- override `.` snippet

Is not supported in the web for now.

### Array Method Snippets

(*disabled by default*)

Edits array suggestions that receive predicate in the following way:

```ts
const usersList = []

usersList.map // -> usersList.map((user) => )
```

### Case-sensitive Completions

(*disabled by default*)

Filter out completions that start with different casing.

### Remove Definition From References

(*enabled by default*)

<https://github.com/microsoft/vscode/issues/160637>

### Remove Imports From References

(*enabled by default*)

Removes import statements from references when symbol has usages in the same file. Why? Because if export thing is used in another file, it might be obvious that it is imported, and most probably you are not interested in import statements.

## Minor Useful Features

### `enablePlugin` setting

You can quickly disable this plugin functionality by setting this setting to false. Useful for debugging a problem for example.

> Note: this setting doesn't disable Vue support.

### Vue Support

`.vue` SFC files support is disabled, but can be enabled with setting and when [Vue Language Features (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) is installed.

Enable now: `"tsEssentialPlugins.enableVueSupport": true` (if you're not using local `./volar.config.js`)

For the first time, it will configure `volar.vueserver.configFilePath` setting.

This also makes plugin work in Volar's takeover mode!

### Web Support

> Note: when you open TS/JS file in the web for the first time you currently need to switch editors to make everything work!

Web-only feature: `import` path resolution

### `in` Keyword Suggestions

[Demo](https://github.com/zardoy/typescript-vscode-plugins/pull/19)

### Highlight non-function Methods

(*enabled by default*)

Highlights and lifts non-function methods. Also applies for static class methods.

### Indexed Signature Completions

```ts
const bannedUsers = {
    admin: false,
    moderator: false,
}
bannedUsers[condition ? 'admin' : 'moderator'] = true
//          adds suggestions ^      ^ deranks admin suggestion
```

### Remove Useless Code Fixes

(*enabled by default*)

By default removes `Fix Missing Function Declaration` codefix. Possibly to remove more via setting.

### Remove Useless Function Props

(*enabled by default*)

Removes `Symbol`, `caller`, `prototype` completions on function / classes.

### Keywords Insert Text

(*enabled by default*)

Appends *space* to almost all keywords e.g. `const `, like WebStorm does.

### Patch `toString()`

(*enabled by default*)

Patches `toString()` insert function snippet on number types to remove tabStop.

### Enforce Properties Sorting

(*disabled by default*) enable with `tsEssentialPlugins.fixSuggestionsSorting`

Try to restore [original](https://github.com/microsoft/TypeScript/issues/49012) properties sorting in some places such as object destructure & dot property access.

### File Extension Suggestions

We extend completion list with extensions from module augmentation (e.g. `.css` files if you have `declare module '*.css'`).
But for unchecked contexts list of extensions can be extended with `tsEssentialPlugins.additionalIncludeExtensions` setting.

### Switch Exclude Covered Cases

(*enabled by default*)

Exclude already covered strings / enums from suggestions ([TS repo issue](https://github.com/microsoft/TypeScript/issues/13711)).

### Mark Code Actions

(*enabled by default* with two settings)

Mark all TS code actions with `🔵`, so you can be sure they're coming from TypeScript, and not some other extension.

### Additional Types Suggestions

```ts
// Adds types in default constraint:
type A<T extends 'foo' | 'bar' = ''> = ...
```

### Builtin Code Fix Fixes

With this plugin fixes some builtin code actions and these code fixes will work *correctly*:

```ts
// ctrl+s fix: only one async is added
const syncFunction = () => {
    await fetch()
    await fetch()
}
const a = 5
// const to let fix
a = 6
```

## Auto Imports

With this plugin you have total (almost) control over auto imports that appear in completions, quick fixes and import all quick fix. Some examples of what you can do:

- I never want to see `join` suggestion from `path/win32` module (it's a Node.js [module](https://nodejs.org/dist/latest-v18.x/docs/api/path.html#pathwin32), defined via module augmentation)
- I never want to see any suggestions from `path/*` modules
- I always want `join` to be imported from `path/posix` module on window (also would appear first in completions & single quick fix)
- I always want `useState` to be imported from local files first

Some settings examples:

<!-- just duplicated from configurationType -->

```jsonc
"suggestions.ignoreAutoImports": [
  "path", // ignore path, but not path/posix or path/win32 modules
  "path/*", // ignore path, path/posix and path/win32
  "path/*#join", // ignore path, path/posix and path/win32, but only join symbol
  "path/*#join,resolve", // ignore path, path/posix and path/win32, but only join and resolve symbol
],
"autoImport.changeSorting": {
    "join": ["path/posix"], // other suggestions will be below
    "resolve": ["*", "path/posix"], // make `path/posix` appear below any other suggestions
    "useState": ["."], // `.` (dot) is reserved for local suggestions, which makes them appear above other
},
// for some even more specific cases?
// "autoImport.alwaysIgnoreInImportAll": ["lodash"] // exclude all possible imports from import all request
```

> Note: changeSorting might not preserve sorting of other existing suggestions which not defined by rules, there is WIP
> Also I'm thinking of making it learn and syncing of most-used imports automatically

## Special Commands List

### Go to / Select Nodes by Kind

Use cases: search excluding comments, search & replace only within strings, find interested JSX attribute node

## Contributed Code Actions

### Swap Keys and Values in Object

> *Note*: Code action displayed **only** when object is fully explicitly selected

Example:

```ts
const obj = {
    key1: 'someValue',
    key2: getSuperUniqueKey()
}
// turns into
const obj = {
    'someValue': 'key1',
    [getSuperUniqueKey()]: 'key2'
}
```

### Turn Array Into Object

```ts
const data = [
    {
        // test
        key: 'bar',
        a: 0
    },
    {
        key: 'baz',
        // yes
        b: 1
    }
]
```

After selecting code action, you'll get asked for key to used (here you can use only `key`) and after applying:

```ts
const a = {
    'bar': {
        a: 0
    },
    'baz': {
        // yes
        b: 1
    }
}
```

(note that for now refactoring removes properties with comments!)

## Even Even More

Please look at extension settings, as this extension has much more features than described here!
