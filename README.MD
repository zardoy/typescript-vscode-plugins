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

(*enabled by default*) when react langs are in ``

You can force enable it by using `Enable Strict Emmet in JSX` command.

You can turn off emmet integration in JSX and stable emmet suggestion will be *always* within JSX elements.

*Why?* Issues it fixes: [query](https://github.com/microsoft/vscode/issues?q=sort%3Aupdated-desc+51537+150671+142978+119736).

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

Appends *space* to almost all keywords e.g. `extends `, like WebStorm does.

### Patch `toString()`

(*enabled by default*)

Patches `toString()` insert function snippet on number types to remove tabStop.

### Correct Sorting

(*enabled by default*, but doesn't work properly in new versions for now)

### Mark Code Actions

(*enabled by default* with two settings)

Mark all TS code actions with `🔵`, so you can be sure they're coming from TypeScript, and not some other extension.

### Builtin CodeFix Fixes
