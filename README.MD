# TypeScript Essential Plugins

## Top Features

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

- cleanup input & textarea suggestions
- override `.` snippet

Is not supported in the web for now.

### Array Method Snippets

(*disabled by default*)

Edits array suggestions that receive predicate in the following way:

```ts
const usersList = []

usersList.map // -> usersList.map((user) => )
```

### Remove Definition From References

(*enabled by default*)

<https://github.com/microsoft/vscode/issues/160637>

## Minor Useful Features

### Web Support

> Note: when you open TS/JS file in the web for the first time you currently need to switch editors to make everything work!

Web-only feature: `import` path resolution

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

### Builtin CodeFix Fixes

## Even Even More

Please look at extension settings, as this extension has much more features than described here!
