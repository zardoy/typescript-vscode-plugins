//@ts-check
import fs from 'fs'

try {
    fs.unlinkSync('.vscode-test/user-data/User/settings.json')
} catch {}

try {
    fs.unlinkSync('out/plugin-config.json')
} catch {}
