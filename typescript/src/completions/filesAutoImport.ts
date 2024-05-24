import { camelCase, pascalCase, snakeCase, constantCase } from 'change-case'
import { Configuration } from '../types'
import { nodeModules } from '../utils'
import { sharedCompletionContext } from './sharedContext'

export default () => {
    const { c, prior, languageService, languageServiceHost, node, sourceFile, prevCompletionsMap } = sharedCompletionContext
    // todo better web support?
    if (!node || !languageServiceHost.readDirectory || !nodeModules?.path) return
    const filesAutoImport = c('filesAutoImport')
    const included: Array<{ ext: string; item: Configuration['filesAutoImport'][string] }> = []
    const currentText = node.getText()
    for (const [ext, item] of Object.entries(filesAutoImport)) {
        if (currentText.startsWith(item.prefix)) included.push({ ext, item })
    }
    if (included.length === 0) return
    const root = languageServiceHost.getCurrentDirectory()
    const collected = [] as string[]
    const MAX_ITERATIONS = 200
    let iter = 0
    const collectFiles = (dir: string) => {
        iter++
        if (iter > MAX_ITERATIONS) {
            console.error('[essentials plugin filesAutoImport] Max iterations reached')
            return
        }
        const files = nodeModules!.fs.readdirSync(dir, { withFileTypes: true })
        for (const file of files) {
            if (file.isDirectory()) {
                if (
                    file.name === 'node_modules' ||
                    file.name.startsWith('.') ||
                    file.name.startsWith('out') ||
                    file.name.startsWith('build') ||
                    file.name.startsWith('dist')
                )
                    continue
                collectFiles(nodeModules!.path.join(dir, file.name))
            } else if (file.isFile()) {
                // const ext = nodeModules!.path.extname(file.name)
                // if (included.some(i => i.ext === ext)) files.push(nodeModules!.path.join(dir, file.name))
                collected.push(nodeModules!.path.relative(root, nodeModules!.path.join(dir, file.name)))
            }
        }
    }
    collectFiles(root)

    const lastImport = sourceFile.statements.filter(ts.isImportDeclaration).at(-1)

    // const directory = languageServiceHost.readDirectory(root, undefined, undefined, undefined, 1)
    const completions: Array<{
        name: string
        insertText: string
        addImport: string
        detail: string
        description: string
        sort: number
    }> = []
    for (const { ext, item } of included) {
        const files = collected.filter(f => f.endsWith(ext))
        for (const file of files) {
            const fullPath = nodeModules.path.join(root, file)
            let relativeToFile = nodeModules.path.relative(nodeModules.path.dirname(sourceFile.fileName), fullPath).replaceAll('\\', '/')
            if (!relativeToFile.startsWith('.')) relativeToFile = `./${relativeToFile}`
            const lastModified = nodeModules.fs.statSync(fullPath).mtime
            const lastModifiedFormatted = timeDifference(Date.now(), lastModified.getTime())
            const importPath = (item.importPath ?? '$path').replaceAll('$path', relativeToFile)
            const casingFn = {
                camel: camelCase,
                pascal: pascalCase,
                snake: snakeCase,
                constant: constantCase,
            }
            const name =
                item.prefix + casingFn[item.nameCasing ?? 'camel']((item.nameTransform ?? '$name').replaceAll('$name', nodeModules.path.basename(file, ext)))
            if (prior.entries.some(e => e.name === name)) continue
            completions.push({
                name,
                insertText: name,
                sort: Date.now() - lastModified.getTime(),
                detail: `${item.iconPost?.replaceAll('$path', relativeToFile) ?? '📄'} ${lastModifiedFormatted}`,
                description: importPath,
                addImport: `import ${name} from '${importPath}'`,
            })
        }
    }

    const prependImport = lastImport ? '\n' : ''
    const entries = completions.map(({ name, insertText, detail, sort, addImport, description }): ts.CompletionEntry => {
        prevCompletionsMap[name] = {
            textChanges: [
                {
                    newText: `${prependImport}${addImport}`,
                    span: {
                        start: lastImport?.end ?? 0,
                        length: 0,
                    },
                },
            ],
            documentationOverride: description,
        }
        return {
            kind: ts.ScriptElementKind.variableElement,
            name,
            insertText,
            sortText: `${sort}`,
            labelDetails: {
                description: detail,
            },
            // description,
        }
    })
    return entries
}

function timeDifference(current, previous) {
    const msPerMinute = 60 * 1000
    const msPerHour = msPerMinute * 60
    const msPerDay = msPerHour * 24
    const msPerMonth = msPerDay * 30
    const msPerYear = msPerDay * 365

    const elapsed = current - previous

    if (elapsed < msPerMinute) {
        return `${Math.round(elapsed / 1000)} sec ago`
    }

    if (elapsed < msPerHour) {
        return `${Math.round(elapsed / msPerMinute)} min ago`
    }

    if (elapsed < msPerDay) {
        return `${Math.round(elapsed / msPerHour)} h ago`
    }

    if (elapsed < msPerMonth) {
        return `${Math.round(elapsed / msPerDay)} days ago`
    }

    if (elapsed < msPerYear) {
        return `${Math.round(elapsed / msPerMonth)} months ago`
    }

    return `${Math.round(elapsed / msPerYear)} years ago`
}
