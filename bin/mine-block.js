const fs = require('fs')
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
  try {
    return JSON.parse(execSync(`cat ./accounts/${accountId}/state.json`).toString())
  } catch (error) {
    return undefined
  }
}

function setBalance(accountId, amount) {
  try {
    if (isNaN(amount)) {
      throw new Error('amount is NaN')
    }
    if (amount < 0) {
      throw new Error('amount is negative')
    }
    if (typeof amount !== 'number') {
      throw new Error('amount is not number')
    }
    console.log('[INFO] Set balance of', accountId, 'to', amount)
    execSync(`mkdir -p ./accounts/${accountId}`)
    execSync(`echo ${amount} > ./accounts/${accountId}/balance`)
  } catch (e) {
    throw new Error(`Cannot set balance of accountId to ${amount}: ${e}`)
  }
}

function setState(accountId, state) {
  try {
    execSync(`mkdir -p ./accounts/${accountId}`)
    fs.writeFileSync(`./accounts/${accountId}/state.json`, JSON.stringify(state, null, 2))
  } catch (e) {
    throw new Error(`Cannot set initial state of accountId ${accountId}: ${e}`)
  }
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
    let transactionsProcessed = 0
    for (const transactionBranch of transactionBranches) {
      const commits = execSync(`git cherry -v master ${transactionBranch}`)
        .toString()
        .split('\n')
        .slice(0, -1)

      // validate branch: 1 commit
      if (commits.length !== 1) continue
      // validate branch: commit must be signed and own by sender
      // validate branch: commit must be empty (no file changed)

      const commitLine = commits[0]
      if (commitLine.match(/[-+] (.+) create contract (.+)/)) {
        let mm = commits[0].match(/[-+] (.+) create contract (....\/....\/....\/....)/)
        const commitHash = mm[1]
        const receiverId = mm[2]
        const debugInfo = { commitLine }
        try {
          execSync(
            `git merge --allow-unrelated-histories --no-commit ${transactionBranch}`
          )
          const contract = getContract(receiverId)
          setState(receiverId, contract.initialState)

          execSync(`git add .`)
          execSync(`git commit -S -m 'successful transaction ${commitHash}'`)
        } catch (error) {
          console.log('[INFO] Failed transaction ' + commitHash + ': ' + error, debugInfo)
          execSync(`git commit -S -m 'failed transaction ${commitHash}: ${error}'`)
        }
        transactionsProcessed += 1
        continue
      }
      if (/[-+] (.+) transaction transfer .+/) {
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
        const debugInfo = { senderId, senderBalance, transaction }
        try {
          validateTransaction(blockNumber, transaction, senderBalance)

          const receiverId = transaction.to
          let receiverBalance = getThisBranchBalance(receiverId)
          const fee = transaction.fee || 0

          Object.assign(debugInfo, { receiverId, receiverBalance, fee })

          const contract = getContract(receiverId)

          if (contract) {
            if (typeof contract.reducer !== 'function') throw new Error('Not a function')

            let state = getThisBranchState(receiverId)

            const branchHash = execSync('git rev-parse my-block').toString()

            setBalance(senderId, senderBalance - transaction.amount - fee)
            receiverBalance += transaction.amount

            const stat2e = contract.reducer(state, null, {
              hash: branchHash,
              minerId,
              sender: { id: senderId },
              balance: receiverBalance,
              transferTo: (id, amount) => {
                receiverBalance -= amount
                setBalance(id, getThisBranchBalance(id) + amount)
              }
            })
            setBalance(receiverId, receiverBalance)
            setState(receiverId, stat2e)
          } else {
            setBalance(senderId, senderBalance - transaction.amount - fee)
            setBalance(receiverId, receiverBalance + transaction.amount)
          }

          totalFeeAmount += fee || 0

          execSync(`git add .`)
          execSync(`git commit -S -m 'successful transaction ${commitHash}'`)
        } catch (error) {
          console.log('[INFO] Failed transaction ' + commitHash + ': ' + error, debugInfo)
          console.log(error.stack)
          execSync(`git commit -S -m 'failed transaction ${commitHash}: ${error}'`)
        }

        transactionsProcessed += 1
      }
    }

    execSync(`git checkout -f master`)
    execSync(`git branch -D master-staging`)
    execSync(`git checkout -b master-staging`)
    if (transactionsProcessed > 0) {
      execSync(`git merge --no-ff --no-commit my-block`)
    }

    // |=============================================================|
    // |                         GIVE REWARD                         |
    // |=============================================================|
    function generateCommitMessage(nonce) {
      return `block ${blockNumber} [nonce=${nonce}]`
    }

    const minerBalance = getThisBranchBalance(minerId)
    setBalance(minerId, minerBalance + REWARD + totalFeeAmount)
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
    try {
      execSync(`git push`)
      log('create new block!')
    } catch (error) {
      log('master is outdated!')
    }
  } catch (error) {
    log(error)
    throw error
  }
}

run()
