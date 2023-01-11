// exposed ts essentials plugins lib methods for external usage from npm

export const initTypeScriptEssentialsPlugins = (typescript: typeof ts) => {
    ts = tsFull = typescript as any
}
