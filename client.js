const { exec } = require('child_process')

class GitthereumClient {
    constructor(repoPath, options={}) {
        this._repoPath = repoPath
        this.options = options
    }

    _exec(command, options=this.options) {
        return new Promise(
            (resolve, reject) => {
                exec(`${command}`, options, (err, stdout, stderr) => {
                    if(err) {
                        reject(err, stderr)
                    } else {
                        resolve(stdout.trim())
                    }
                })
            }
        )        
    }

    _execGPG(command, options) {
        return this._exec(`gpg ${command}`, options)
    }

    _execGit(command, options) {
        return this._exec(`git -C ${this._repoPath} ${command}`, options)
    }

    _lsFiles(path="", branch="master") {
        return this._execGit(`ls-tree -r --name-only ${branch}:${path}`)
                .then(output => output)
    }

    getBalance(account, branch="master") {
        // return this._execGit(`show ${branch}:accounts/${account}/balance`)
        //         .then(output => parseInt(output))
        return this._execGit(`show ${branch}:accounts/${account}/balance`)
                .then(output => parseInt(output))
    }

    async publishTransaction(type, payload) {
        await this._execGit(`checkout --orphan my-transaction`)
        await this._execGit(`reset`)
        const commitMessage = 'transaction ' + type + ' ' + JSON.stringify(payload)
        await this._execGit(`commit --allow-empty -S -m '${commitMessage}'`)
        const commitHash = await this._execGit('rev-parse HEAD')
        const branchName = `transactions/${commitHash}`
        await this._execGit(`branch -m ${branchName}`)
        return commitHash
    }

    transfer(to, amount) {
        return this.publishTransaction('transfer', {to, amount})
    }
}

module.exports = GitthereumClient