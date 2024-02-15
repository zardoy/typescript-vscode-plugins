import fs from 'fs'

fs.copyFileSync('./typescript/npm/package.json', './typescript/package.json')

const packageJson = JSON.parse(fs.readFileSync('./typescript/package.json', 'utf8'))
packageJson.version = JSON.parse(fs.readFileSync('./package.json', 'utf8')).version
if (packageJson.version === '0.0.0-dev') packageJson.version = '0.0.0'
fs.writeFileSync('./typescript/package.json', JSON.stringify(packageJson, null, 2))
