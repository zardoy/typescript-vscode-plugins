// exposed ts essentials plugins lib methods for external usage from npm

export const initTypeScriptEssentialsPlugins = (typescript: typeof ts) => {
    // eslint-disable-next-line no-multi-assign
    ts = tsFull = typescript as any
}
