// eslint-disable-next-line @typescript-eslint/no-require-imports
import ts = require('typescript/lib/tsserverlibrary')
export = ts
export as namespace ts
declare global {
    let ts: typeof import('typescript/lib/tsserverlibrary')
}
