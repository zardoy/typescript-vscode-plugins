<!-- https://github.com/vitest-dev/vitest/blob/main/CONTRIBUTING.md -->
# TypeScript Essential Plugins Contributing Guide

Hi! Thank you so much for contributing to TypeScript Essential Plugins VS Code extension! We are really excited to bring high quality features and stability and we really appreciate any interest in it!
Let us give you some high-level overview for you.

## Repo Setup

> Quick Tip: You can use [ni](https://github.com/antfu/ni) to help switching between repos using different package managers.
> `ni` is equivalent to `pnpm install` and `nr script` is equivalent to `pnpm script`

### Start in Development

To start the VS Code plugin extension locally for developing:

0. Ensure you have pnpm installed (minimum v6): `npm i -g pnpm`

1. Run `pnpm install` in root folder

2. Run `pnpm start` to build extension and typescript plugin in watch mode. After initial build you can open VS Code window in development by pressing F5 to **start debugging session** (or by running `> Debug: Select and Start Debugging` and selecting *Extension + TS Plugin*).

- Note, that window will *be reloaded after each change in `src/*` automatically*. Note that each development window reload most probably cause erase of unsaved files/data. Also if you frequently change files in `src/*` you can uncomment `--disable-extensions` in launch.json for faster window reloads.

### Files Structure Overview

- `src/*` - VS Code extension code, that is specific to VS Code extension API only. Most probably you don't need to change it. (For now there is a limitation from vscode-framework so folder name cannot be changed to something like `extension` or `vscode`.)
- `src/configurationType.ts` - Extension configuration live here. Add / change settings here. It is used to generate `out/package.json`'s `contributes.configuration`.
- `typescript/*` - TypeScript plugin code, that integrates into TypeScript language service. After you change code in it, you need run to `> TypeScript: Restart TS server` to see changes (or `> Volar: Restart Vue server` for Vue files). Thats why it is useful to bind it to a shortcut.

### Running Tests

#### Unit Tests

They are in `typescript/test` and using vitest, so they faster than integration. Feel free to add new tests here. But note that most of tests are completion tests, but I do hope to add more types tests in the future.

To launch them run `pnpm test-plugin`.

#### Integration Tests

They are in `integration`. This type of tests launches VSCode. For now I don't recommend either running or adding new tests here, use unit tests.
> Note that while running this script, you must also keep `pnpm start` running in the background. However, changing a file in `src/`, won't relaunch integration tests. If this is your case, you should edit the script.
