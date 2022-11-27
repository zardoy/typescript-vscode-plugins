import stream from 'node:stream'
import got from 'got'
import util from 'util'
import { createWriteStream, existsSync, readFileSync } from 'fs'

// use tsx to run file

const diagnosticMessagesFile = './typescript/scripts/diagnostics.json'
if (!existsSync(diagnosticMessagesFile)) {
    const pipeline = util.promisify(stream.pipeline)
    await pipeline(
        got.stream('https://raw.githubusercontent.com/microsoft/TypeScript/main/src/compiler/diagnosticMessages.json'),
        createWriteStream(diagnosticMessagesFile),
    )
}

const query = process.argv[2]
const isRegex = process.argv.includes('--regex')
const diagnostics: Record<string, { code }> = JSON.parse(readFileSync(diagnosticMessagesFile, 'utf8'))

if (query) {
    const regex = isRegex ? new RegExp(query) : undefined
    console.log(
        Object.entries(diagnostics)
            .filter(([key]) => {
                const match = regex ? regex.test(key) : key.toLowerCase().includes(query)
                if (regex) regex.lastIndex = 0
                return match
            })
            // this should be adjusted from the case
            .map(([key, value]) => `${value.code}, /* ${key.replaceAll('\n', ' ')} */`)
            .join('\n'),
    )
}
