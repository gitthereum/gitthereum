const { exec } = require('child_process')

class Executor {
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
}

module.exports = Executor