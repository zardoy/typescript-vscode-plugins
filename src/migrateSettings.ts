import { migrateExtensionSettings } from '@zardoy/vscode-utils/build/migrateSettings'

export default () => {
    void migrateExtensionSettings(
        [
            {
                rename: {
                    old: 'jsxEmmet',
                    new: 'jsxEmmet.enable',
                    mustBePrimitive: true,
                },
            },
            {
                rename: {
                    old: 'jsxPseudoEmmet',
                    new: 'jsxPseudoEmmet.enable',
                    mustBePrimitive: true,
                },
            },
            {
                rename: {
                    old: 'suggestions.banAutoImportPackages',
                    new: 'suggestions.ignoreAutoImport',
                    mustBePrimitive: false,
                },
            },
        ],
        process.env.IDS_PREFIX!,
    )
}
