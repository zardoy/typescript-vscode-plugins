import * as vscode from 'vscode'
import fs from 'fs'
import { extensionCtx } from 'vscode-framework'

export default () => {
    const status = vscode.window.createStatusBarItem('plugin-auto-reload', vscode.StatusBarAlignment.Left, 1000)
    status.show()
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(extensionCtx.extensionUri, 'build_plugin_result'))
    const updateStatus = uri => {
        const newStatus = fs.readFileSync(uri.fsPath, 'utf8')
        if (newStatus === '1') {
            void vscode.commands.executeCommand('typescript.restartTsServer')
            status.text = 'Latest'
        }

        if (newStatus === '0') {
            status.text = 'Rebuilding'
        }

        if (newStatus === '2') {
            status.text = 'Build errored'
        }
    }

    watcher.onDidChange(updateStatus)
    watcher.onDidCreate(updateStatus)
}
