const { execSync } = require('child_process')

const getContract = require('../lib/getContract')
const getSender = require('../lib/getSender')
const validateTransaction = require('../lib/validateTransaction')

const log = console.log

const REWARD = 1000000

function getThisBranchBalance(accountId) {
  execSync(`mkdir -p $(dirname ./accounts/${accountId}/balance)`)
  try {
    return parseInt(execSync(`cat ./accounts/${accountId}/balance`).toString())
  } catch (error) {
    return 0
  }
}

function getThisBranchState(accountId) {
  execSync(`mkdir -p $(dirname ./accounts/${accountId}/state)`)
  try {
    return JSON.parse(execSync(`cat ./accounts/${accountId}/state`).toString())
  } catch (error) {
    return undefined
  }
}

function transferTo(accountId, amount) {
  execSync(`mkdir -p $(dirname ./accounts/${accountId}/balance)`)
  execSync(`echo ${amount} > ./accounts/${accountId}/balance`)
}

async function run() {
  try {
    execSync('export GPG_TTY=$(tty)')

    execSync(`git checkout -f master`)
    execSync(`git reset --hard master`)
    execSync(`git branch -D my-block`)
    execSync(`git checkout -b my-block`)

    const minerId = execSync(`git config user.signingkey`)
      .toString()
      .match(/.{1,4}/g)
      .join('/')
    const blockNumber =
      parseInt(
        execSync(`git log -1 --pretty=%B`)
          .toString()
          .replace(/block (\d+) \[nonce=\d+]/g, '$1')
      ) + 1

    if (blockNumber === NaN) return

    let totalFeeAmount = 0

    // |=============================================================|
    // |                  LOOP PROCESS TRANSACTIONS                  |
    // |=============================================================|
    const transactionBranches = execSync(`git branch -r | grep transactions/`)
      .toString()
      .match(/origin\/transactions\/[\d\w]+/g)
    for (const transactionBranch of transactionBranches) {
      const commits = execSync(`git cherry -v master ${transactionBranch}`)
        .toString()
        .split('\n')
        .slice(0, -1)

      // validate branch: 1 commit
      if (commits.length !== 1) continue
      // validate branch: commit must be signed and own by sender
      // validate branch: commit must be empty (no file changed)
      // validate branch: commit hash must be the same as branch name
      const commitHash = commits[0].match(/[-+] (.+) transaction transfer .+/)[1]
      const transaction = JSON.parse(commits[0].match(/\{.+/g)[0])
      const transactionId = transactionBranch.replace(
        /origin\/transactions\/([\d\w]+)/g,
        '$1'
      )
      if (commitHash !== transactionId) continue

      const senderId = (await getSender(commitHash)).id
      const senderBalance = getThisBranchBalance(senderId)

      execSync(`git merge --allow-unrelated-histories --no-commit ${transactionBranch}`)
      try {
        const { error } = validateTransaction(blockNumber, transaction, senderBalance)
        if (error) throw new Error(error)

        const receiverId = transaction.to
        const receiverBalance = getThisBranchBalance(receiverId)

        const contract = getContract(receiverId)

        if (contract) {
          if (typeof contract.initialState !== Object) throw new Error()
          if (typeof contract.reducer !== Function) throw new Error()

          let state = getThisBranchState(receiverId) || contract.initialState
          const branchHash = execSync('git rev-parse my-block').toString()

          contract.reducer(state, null, {
            hash: branchHash,
            minerId,
            balance: receiverBalance,
            transferTo
          })
        } else {
          transferTo(senderId, senderBalance - transaction.amount)
          transferTo(receiverId, receiverBalance + transaction.amount - transaction.fee)
        }

        totalFeeAmount += transaction.fee || 0

        execSync(`git add .`)
        execSync(`git commit -S -m 'successful transaction ${commitHash}'`)
      } catch (error) {
        execSync(`git commit -S -m 'failed transaction ${commitHash}: ${error}'`)
      }
    }

    execSync(`git checkout -f master`)
    execSync(`git branch -D master-staging`)
    execSync(`git checkout -b master-staging`)
    execSync(`git merge --no-ff --no-commit my-block`)

    // |=============================================================|
    // |                         GIVE REWARD                         |
    // |=============================================================|
    function generateCommitMessage(nonce) {
      return `block ${blockNumber} [nonce=${nonce}]`
    }

    const minerBalance = getThisBranchBalance(minerId)
    transferTo(minerId, minerBalance + REWARD + totalFeeAmount)
    execSync(`git add .`)
    execSync(`git commit -S -m '${generateCommitMessage(0)}'`)

    // |=============================================================|
    // |                        PROVE OF WORK                        |
    // |=============================================================|

    let i = 1
    while (true) {
      const commitMessage = generateCommitMessage(i++)
      execSync(`git commit --amend -S -m '${commitMessage}'`)
      const commitHash = execSync(`git rev-parse HEAD`).toString()
      log(`${commitMessage}: ${commitHash}`)

      if (commitHash.substring(0, 2) === '55') {
        break
      }
    }

    execSync(`git checkout master`)
    execSync(`git merge --ff-only master-staging`)
    // try {
    //   execSync(`git push`)
    //   log('create new block!')
    // } catch (error) {
    //   log('master is outdated!')
    // }
  } catch (error) {
    log(error)
    throw error
  }
}

run()
