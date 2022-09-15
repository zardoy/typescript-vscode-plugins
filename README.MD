# TypeScript Essential Plugins

## Top Features

### JSX Outline

(*disabled by default*) Enable with `tsEssentialPlugins.patchOutline`

Add JSX elements to outline. It also makes sticky scroll works with your tags!

Super recommended for react. Fragments are not rendered.

### Method Snippets

(*enabled by default*)

Expands arrow callbacks with signature snippet with adding additional undo stack!

Example:

```ts
const callback = (arg) => {}
callback -> callback(arg)
```

### Clean Emmet

(*enabled by default*)

You can turn off emmet integration in JSX and stable emmet suggestion will be *always* within JSX elements.

*Why?* <https://github.com/microsoft/vscode/issues/51537>

- supports only tag expansion for now, have 2 modes

### Remove Definition From References

(*enabled by default*)

<https://github.com/microsoft/vscode/issues/160637>

## Minor Useful Features

### Highlight non-function Methods

(*enabled by default*)

Highlights and lifts non-function methods. Also applies for static class methods.

### Remove Useless Code Fixes

(*enabled by default*)

By default removes `Fix Missing Function Declaration` codefix. Possibly to remove more via setting.

### Remove Useless Function Props

(*enabled by default*)

Removes `Symbol`, `caller`, `prototype` completions on function / classes.

### Patch `toString()`

(*enabled by default*)

Patches `toString()` insert function snippet on number types to remove tabStop.

### Keywords Insert Text

(*enabled by default*)

Almost all keywords would insert space after the name of keyword e.g. `extends` -> `extends `

### Correct Sorting

(*enabled by default*, but doesn't work properly in new versions for now)

### Mark Code Actions

(*enabled by default* with two settings)

Mark all TS code actions with `🔵`, so you can be sure they're coming from TypeScript, and not some other extension.

### Builtin CodeFix Fixes
