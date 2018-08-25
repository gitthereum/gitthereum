const argv = require('minimist')(process.argv.slice(2))
const childProcess = require('child_process')
const chalk = require('chalk')
const openpgp = require('openpgp')

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
  await run(targetCommit, { knownCommit })
}

/**
 * @param {string} currentCommit
 * @param {{ knownCommit?: string, previousBlockNumber?: number }} options
 */
async function run(currentCommit, options = {}) {
  const { knownCommit, previousBlockNumber } = options
  console.log(chalk.bold('==> Now checking'), currentCommit)
  if (knownCommit && knownCommit === currentCommit) {
    console.log(chalk.green('[OK] This commit is a known commit.'))
    return
  }
  const message = childProcess
    .execFileSync('git', ['log', '-n', '1', '--pretty=format:%s', currentCommit])
    .toString()
  const parent1 = tryResolveSha(`${currentCommit}^1`)
  const parent2 = tryResolveSha(`${currentCommit}^2`)
  const author = await getSender(currentCommit)
  console.log(chalk.cyan('[INFO] ' + `Sender is ${author.id}`))
  if (!parent1) {
    if (!message.match(/^genesis/)) {
      throw new Error(`Expected commit message to be "genesis", found ${message}`)
    }
    if (previousBlockNumber && previousBlockNumber > 1) {
      throw new Error(`Block sequence skipped (${previousBlockNumber} -> genesis)`)
    }
    console.log(chalk.cyan('[INFO] Genesis block found'))
    return
  }
  m = message.match(/^block (\d+)/)
  if (!m) {
    throw new Error(`Expected commit message to be "block <N>", found ${message}`)
  }
  const blockNumber = +m[1]
  if (previousBlockNumber && previousBlockNumber !== blockNumber + 1) {
    throw new Error(`Block sequence skipped (${previousBlockNumber} -> ${blockNumber})`)
  }
  console.log(chalk.cyan(`[INFO] Block number is ${blockNumber}`))
  if (!parent2) {
    console.log(chalk.cyan('[INFO] No-transaction block found'))
    const changedFiles = childProcess
      .execFileSync('git', ['diff', '--name-only', currentCommit, parent1])
      .toString()
      .trim()
    const expectedFile = `accounts/${author.id}/balance`
    if (changedFiles !== expectedFile) {
      throw new Error(
        'Expected ' + expectedFile + ' as the only changed file. Found: ' + changedFiles
      )
    }
    const currentBalance = await getBalance(author.id, currentCommit)
    const previousBalance = await getBalance(author.id, parent1)
    if (currentBalance !== previousBalance + BLOCK_MINE_REWARD) {
      throw new Error(
        `Expected current balance (${currentBalance}) to equal previous balance (${previousBalance}) + block mine reward ${BLOCK_MINE_REWARD}.`
      )
    }
    console.log(chalk.green('[OK] Valid commit!'))
    return run(parent1, options)
  }
  console.log(chalk.cyan('[INFO] Block with transactions found'))
}

async function getSender(commit) {
  const data = childProcess.execFileSync('git', ['cat-file', 'commit', commit]).toString()
  let m = data.match(
    /gpgsig (-----BEGIN PGP SIGNATURE-----[^]+?-----END PGP SIGNATURE-----)/
  )
  if (!m) {
    throw new Error('No PGP signature found.')
  }
  const options = {
    signature: await openpgp.signature.readArmored(m[1]),
    message: openpgp.cleartext.fromText(''),
    publicKeys: []
  }
  const info = await openpgp.verify(options)
  const signatures = info.signatures
  if (!signatures.length) {
    throw new Error('Signature not present in PGP signature.')
  }
  const id = signatures[0].keyid.toHex().toUpperCase()
  m = id.match(/^(....)(....)(....)(....)$/)
  if (!m) {
    throw new Error('Key ID is not 16-digit hex.')
  }
  return {
    id: [m[1], m[2], m[3], m[4]].join('/'),
    // HACK: Git only contains 16-digit key ID without public key.
    // Without public key we cannot verify the authenticity of the commit.
    // Future improvement: We can make it auto-fetch the key from PGP keyserver.
    // For now, let’s assume the keyId is valid!
    valid: true,
    verified: true
  }
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
