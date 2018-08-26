// @ts-check
const argv = require('minimist')(process.argv.slice(2))
const childProcess = require('child_process')

/** @type {any} */
const chalk = require('chalk')

const getSender = require('../lib/getSender')

const BLOCK_MINE_REWARD = 1000000

const resolveSha = ref =>
  childProcess
    .execFileSync('git', ['rev-parse', ref])
    .toString()
    .trim()

const tryResolveSha = ref => {
  try {
    return resolveSha(ref)
  } catch (e) {
    return null
  }
}

async function main() {
  // Make unhandled rejections crash Node process.
  process.on('unhandledRejection', up => {
    throw up
  })

  const targetState = argv._[0] || 'master'
  const targetCommit = resolveSha(targetState)
  const knownState = argv.knownState
  const knownCommit = knownState && resolveSha(knownState)
  const pointer = (state, commit) => (state === commit ? commit : `${state} => ${commit}`)
  console.log('* Going to check', pointer(targetState, targetCommit))
  if (knownCommit) {
    console.log('* Assuming checked commit', pointer(knownState, knownCommit))
  } else {
    console.log('* Checking all the way to the genesis block!')
  }

  console.log()
  console.log(chalk.bold.yellow('====> Now checking repository layout!'))
  const checks = []
  await checkRepositoryLayout(targetCommit, { knownCommit, checks })

  console.log()
  console.log(chalk.bold.yellow('====> Now verifying the blockchain!'))
  for (const check of checks) {
    await check()
  }
}

/**
 * @param {string} currentCommit
 * @param {Object} options
 * @param {string} [options.knownCommit]
 * @param {number} [options.previousBlockNumber] }
 * @param {any[]} [options.checks] }
 */
async function checkRepositoryLayout(currentCommit, options = {}) {
  let m
  const { knownCommit, previousBlockNumber } = options
  console.log(chalk.bold('==> Now checking'), currentCommit)
  if (knownCommit && knownCommit === currentCommit) {
    console.log(chalk.green('[OK] This commit is a known commit.'))
    return
  }
  const message = getCommitMessage(currentCommit)
  const parent1 = tryResolveSha(`${currentCommit}^1`)
  const parent2 = tryResolveSha(`${currentCommit}^2`)
  const author = await getSender(currentCommit)
  const check = (title, fn) => {
    options.checks.unshift(async () => {
      const name = `${message.replace(/\s*\[.+/, '')} => ${title}`
      try {
        const msg = await fn()
        console.log(chalk.bold.green('✔︎'), name + chalk.green(msg ? ': ' + msg : ''))
      } catch (e) {
        console.log(chalk.bold.red('✘'), name, chalk.red(e.toString()))
        process.exitCode = 1
      }
    })
  }
  console.log(chalk.cyan('[INFO] ' + `Sender is ${author.id}`))
  if (!parent1) {
    if (!message.match(/^genesis/)) {
      throw new Error(`Expected commit message to be "genesis", found ${message}`)
    }
    check('Block number sequence', () => {
      if (previousBlockNumber && previousBlockNumber > 1) {
        throw new Error(`Block sequence skipped (${previousBlockNumber} -> genesis)`)
      }
      return `genesis => block ${previousBlockNumber}`
    })
    console.log(chalk.cyan('[INFO] Genesis block found'))
    return
  }
  m = message.match(/^block (\d+)/)
  if (!m) {
    throw new Error(`Expected commit message to be "block <N>", found ${message}`)
  }
  const blockNumber = +m[1]
  check('Block number sequence', () => {
    if (previousBlockNumber && previousBlockNumber !== blockNumber + 1) {
      throw new Error(`Block sequence skipped (${previousBlockNumber} -> ${blockNumber})`)
    }
    return `block ${blockNumber} => block ${previousBlockNumber}`
  })
  console.log(chalk.cyan(`[INFO] Block number is ${blockNumber}`))
  if (!parent2) {
    console.log(chalk.cyan('[INFO] No-transaction block found'))
    check('Mining award', async () => {
      return await checkBalanceChange(
        currentCommit,
        parent1,
        author.id,
        BLOCK_MINE_REWARD
      )
    })
    return checkRepositoryLayout(parent1, {
      ...options,
      previousBlockNumber: blockNumber
    })
  }
  console.log(chalk.cyan('[INFO] Block with transactions found'))
  const mergeBase = childProcess
    .execFileSync('git', ['merge-base', parent1, parent2])
    .toString()
    .trim()
  console.log(chalk.cyan('[INFO] Merge base is ' + mergeBase))
  if (parent1 !== mergeBase) {
    throw new Error(
      `Expected the merge base (${mergeBase}) to be the 1st parent (${parent1})`
    )
  }
  const revList = childProcess
    .execFileSync('git', ['rev-list', parent2, `^${parent1}`])
    .toString()
    .match(/[a-f0-9]+/g)
  const processedTransfers = []
  const transfers = {}
  let totalFee = 0
  check('Mining award', async () => {
    return await checkBalanceChange(
      currentCommit,
      parent2,
      author.id,
      totalFee + BLOCK_MINE_REWARD
    )
  })
  for (const rev of revList) {
    const commitMessage = getCommitMessage(rev)
    const commitAuthor = await getSender(rev)
    try {
      console.log(rev, commitAuthor, commitMessage)
      let m
      m = commitMessage.match(/^successful transaction (\w+)/)
      if (m) {
        processedTransfers.push({ rev, id: m[1], failed: false })
        continue
      }
      m = commitMessage.match(/^failed transaction (\w+)/)
      if (m) {
        processedTransfers.push({ rev, id: m[1], failed: true })
        continue
      }
      m = commitMessage.match(/^transaction transfer (\{.+\})/)
      if (m) {
        transfers[rev] = JSON.parse(m[1])
        continue
      }
      throw new Error('unknown commit message')
    } catch (e) {
      console.error(
        chalk.red(
          `[ERROR] while checking ${rev} (${commitMessage}; by ${commitAuthor.id}): ${
            e.toString
          }`
        )
      )
      process.exitCode = 1
    }
  }
  for (const txn of processedTransfers) {
    check(
      `${txn.rev}: ${txn.failed ? 'failed' : 'successful'} transaction ${txn.id}`,
      () => {
        if (!transfers[txn.id]) {
          throw new Error('Transaction commit not found')
        }
        if (!txn.failed) {
          totalFee += transfers[txn.id].fee || 0
        }
        // assume everything went well for now, it’s a hackathon!
      }
    )
  }
  return checkRepositoryLayout(mergeBase, {
    ...options,
    previousBlockNumber: blockNumber
  })
}

function getCommitMessage(currentCommit) {
  return childProcess
    .execFileSync('git', ['log', '-n', '1', '--pretty=format:%s', currentCommit])
    .toString()
}

async function checkBalanceChange(currentCommit, parentCommit, accountId, change) {
  const changedFiles = childProcess
    .execFileSync('git', ['diff', '--name-only', currentCommit, parentCommit])
    .toString()
    .trim()
  const expectedFile = `accounts/${accountId}/balance`
  if (changedFiles !== expectedFile) {
    throw new Error(
      'Expected ' + expectedFile + ' as the only changed file. Found: ' + changedFiles
    )
  }
  const currentBalance = await getBalance(accountId, currentCommit)
  const previousBalance = await getBalance(accountId, parentCommit)
  if (currentBalance !== previousBalance + change) {
    throw new Error(
      `Expected balance of ${accountId} (${currentBalance}) to have increased from ${previousBalance} by ${change} = ${previousBalance +
        change}.`
    )
  }
  return `added ${change} to ${accountId} (balance = ${currentBalance})`
}

function getBalance(user, commitId) {
  try {
    const text = childProcess
      .execFileSync('git', ['show', `${commitId}:accounts/${user}/balance`])
      .toString()
    return +text || 0
  } catch (e) {
    return 0
  }
}

main()
