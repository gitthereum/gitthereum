const { execSync } = require('child_process')

const getSender = require('../lib/getSender')
const validateTransaction = require('../lib/validateTransaction')

const log = console.log

const REWARD = 1000000

async function run() {
  try {
    execSync('export GPG_TTY=$(tty)')

    execSync(`git checkout -f master`)
    execSync(`git reset --hard master`)
    execSync(`git branch -D my-block`)
    execSync(`git checkout -b my-block`)

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

      const sender = (await getSender(commitHash)).id
      const senderAccountPath = `./accounts/${sender}/balance`
      const senderBalance = parseInt(execSync(`cat ${senderAccountPath}`).toString())

      execSync(`git merge --allow-unrelated-histories --no-commit ${transactionBranch}`)
      if (validateTransaction(transaction, senderBalance)) {
        execSync(`echo ${senderBalance - transaction.amount} > ${senderAccountPath}`)
        const receiverPath = `./accounts/${transaction.to}/balance`
        let receiverBalance
        try {
          receiverBalance = parseInt(execSync(`cat ${receiverPath}`).toString())
        } catch (error) {
          receiverBalance = 0
        }
        execSync(`mkdir -p $(dirname ${receiverPath}})`)
        execSync(`echo ${receiverBalance + transaction.amount} > ${receiverPath}`)
        totalFeeAmount += transaction.fee || 0

        execSync(`git add .`)
        execSync(`git commit -S -m 'successful transaction ${commitHash}'`)
      } else {
        execSync(`git commit -S -m 'failed transaction ${commitHash}'`)
      }
    }

    execSync(`git checkout -f master`)
    execSync(`git branch -D master-staging`)
    execSync(`git checkout -b master-staging`)
    execSync(`git merge --no-ff --no-commit my-block`)

    // |=============================================================|
    // |                         GIVE REWARD                         |
    // |=============================================================|
    const accountPath = execSync(`git config user.signingkey`)
      .toString()
      .match(/.{1,4}/g)
      .join('/')
    const balancePath = `./accounts/${accountPath}/balance`
    execSync(`mkdir -p $(dirname ${balancePath}})`)

    let balance

    try {
      balance = parseInt(execSync(`cat ${balancePath}`).toString())
    } catch (error) {
      balance = 0
    }

    // |=============================================================|
    // |                        PROVE OF WORK                        |
    // |=============================================================|
    const blockNumber =
      parseInt(
        execSync(`git log -1 --pretty=%B`)
          .toString()
          .replace(/block (\d+) \[nonce=\d+]/g, '$1')
      ) + 1

    if (blockNumber === NaN) return

    function generateCommitMessage(nonce) {
      return `block ${blockNumber} [nonce=${nonce}]`
    }

    execSync(`echo ${balance + REWARD + totalFeeAmount} > ${balancePath}`)
    execSync(`git add .`)
    execSync(`git commit -S -m '${generateCommitMessage(0)}'`)

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
