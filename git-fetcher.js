const Executor = require('./executor')
const chalk = require('chalk')

class GitthereumFetcher extends Executor {
  _listRemotes() {
    return this._execGit(`remote`).then(remotesRaw => remotesRaw.split('\n'))
  }

  async _isBranchExists(branch) {
    try {
      const branchHash = await this._execGit(`rev-parse --verify ${branch}`)
      return branchHash
    } catch (e) {
      return false
    }
  }

  async listMasterBranches() {
    const remotes = await this._listRemotes()
    const masterBranches = []

    const doesMasterExists = await this._isBranchExists('master')
    if (doesMasterExists) {
      masterBranches.push('master')
    }

    const getMasterFromRemote = async remote => {
      const branchExists = await this._isBranchExists(`${remote}/master`)
      if (branchExists) {
        return `${remote}/master`
      }
      return null
    }
    const masters = await Promise.all(remotes.map(remote => getMasterFromRemote(remote)))
    return masters.filter(i => i !== null).concat(masterBranches)
  }

  fetchAll() {
    return this._execGit(`fetch --all`, { stdio: 'inherit' })
  }

  getLogFromBranch(branch = 'master') {
    return this._execGit(`log ${branch}`)
  }

  async getBlockHeightOfBranch(branch = 'master') {
    try {
      return await this._execGit(`log ${branch} -1 --pretty=%B`).then(output =>
        parseInt(output.match(/block (\d*)/)[1])
      )
    } catch (e) {
      console.error(chalk.red('[ERROR] Cannot get block height of ' + branch + ': ' + e))
      return -1
    }
  }
}

module.exports = GitthereumFetcher
