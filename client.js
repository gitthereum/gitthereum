const Executor = require('./executor')

class GitthereumClient extends Executor {
  _lsFiles(path = '', branch = 'master') {
    return this._execGit(`ls-tree -r --name-only ${branch}:${path}`).then(
      output => output
    )
  }

  getBalance(account, branch = 'master') {
    // return this._execGit(`show ${branch}:accounts/${account}/balance`)
    //         .then(output => parseInt(output))gi
    return this._execGit(`show ${branch}:accounts/${account}/balance`).then(output =>
      parseInt(output)
    )
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

  async checkTransactionStatus(txHash, branch = 'master') {
    const currentBranch = await this._execGit(`rev-parse --abbrev-ref HEAD`)
    if (currentBranch != branch) {
      await this._execGit(`checkout -f ${branch}`)
    }
    const txStatusRaw = await this._execGit(
      `log --grep=${txHash} | grep '[0-9a-zA-Z]* transaction'`
    )
    return txStatusRaw.split(' ')[0]
  }

  transfer(to, amount, fee = 100) {
    if (amount <= 0) throw new Error('amount should be greater than 0')
    if (fee <= 0) throw new Error(`fee cannot be less than 0`)
    if (fee < 1) fee = amount * fee
    if (fee < 100) throw new Error('minimum fee is 100')

    return this.publishTransaction('transfer', { to, amount, fee })
  }

  async pushTransactionToRemote(txHash, remote = 'origin') {
    const currentBranch = await this._execGit(`rev-parse --abbrev-ref HEAD`)
    const targetBranch = `transactions/${txHash}`

    if (currentBranch !== targetBranch) {
      await this._execGit(`checkout -f ${targetBranch}`)
    }

    return await this._execGit(`push ${remote} ${targetBranch}`)
  }
}

module.exports = GitthereumClient
