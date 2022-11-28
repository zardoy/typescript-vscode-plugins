// why? not localized, no magic message parsing and thus more stable
export const getCannotFindCodes = ({ includeFromLib }: { includeFromLib: boolean }) => {
    // invalid possible variable names are commented
    //prettier-ignore
    const fromLib = [
        2583 /* Cannot find name '{0}'. Do you need to change your target library? Try changing the 'lib' compiler option to '{1}' or later. */,
        2584 /* Cannot find name '{0}'. Do you need to change your target library? Try changing the 'lib' compiler option to include 'dom'. */,
    ]
    return [
        2304 /* Cannot find name '{0}'. */,
        2552 /* Cannot find name '{0}'. Did you mean '{1}'? */,
        1225 /* Cannot find parameter '{0}'. */,
        // 2307 /* Cannot find module '{0}' or its corresponding type declarations. */,
        // 2311 /* Cannot find name '{0}'. Did you mean to write this in an async function? */, invalid: await
        // 2318 /* Cannot find global type '{0}'. */,
        2468 /* Cannot find global value '{0}'. */, // not sure
        2503 /* Cannot find namespace '{0}'. */, // import =
        2833 /* Cannot find namespace '{0}'. Did you mean '{1}'? */,
        2580 /* Cannot find name '{0}'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node`. */,
        2581 /* Cannot find name '{0}'. Do you need to install type definitions for jQuery? Try `npm i --save-dev @types/jquery`. */,
        2582 /* Cannot find name '{0}'. Do you need to install type definitions for a test runner? Try `npm i --save-dev @types/jest` or `npm i --save-dev @types/mocha`. */,
        2591,
        /* Cannot find name '{0}'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig. */ 2592,
        /* Cannot find name '{0}'. Do you need to install type definitions for jQuery? Try `npm i --save-dev @types/jquery` and then add 'jquery' to the types field in your tsconfig. */
        2593 /* Cannot find name '{0}'. Do you need to install type definitions for a test runner? Try `npm i --save-dev @types/jest` or `npm i --save-dev @types/mocha` and then add 'jest' or 'mocha' to the types field in your tsconfig. */,
        2662 /* Cannot find name '{0}'. Did you mean the static member '{1}.{0}'? */,
        2663 /* Cannot find name '{0}'. Did you mean the instance member 'this.{0}'? */,
        // 2688 /* Cannot find type definition file for '{0}'. */,  /// <reference types="jquery" />
        // 2726 /* Cannot find lib definition for '{0}'. */,  /// <reference lib="..." />
        // 2727 /* Cannot find lib definition for '{0}'. Did you mean '{1}'? */,
        // 2732 /* Cannot find module '{0}'. Consider using '--resolveJsonModule' to import module with '.json' extension. */,
        // 2792 /* Cannot find module '{0}'. Did you mean to set the 'moduleResolution' option to 'node', or to add aliases to the 'paths' option? */,
        // 5009 /* Cannot find the common subdirectory path for the input files. */,
        // 5057 /* Cannot find a tsconfig.json file at the specified directory: '{0}'. */,
        // 5081 /* Cannot find a tsconfig.json file at the current directory: {0}. */,
        ...(includeFromLib ? fromLib : []),
    ]
}
