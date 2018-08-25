const Argv = require('minimist')(process.argv.slice(2), { '--': true })
const { execSync } = require('child_process')

const chainPath = Argv['path']

const log = console.log

const REWARD = 1000000

function run() {
  try {
    const chainGit = `git -C ${chainPath}`
    execSync(`${chainGit} pull`)
    execSync(`${chainGit} reset --hard origin/master`)
    execSync('export GPG_TTY=$(tty)')

    const blockNumber =
      parseInt(
        execSync(`${chainGit} log -1 --pretty=%B`)
          .toString()
          .replace(/block (\d+) \[nonce=\d+]/g, '$1')
      ) + 1

    if (blockNumber === NaN) return

    function generateCommitMessage(nonce) {
      return `block ${blockNumber} [nonce=${nonce}]`
    }

    const accountPath = execSync(`${chainGit} config user.signingkey`)
      .toString()
      .match(/.{1,4}/g)
      .join('/')
    // TODO: Fix the case where account directory is not created yet
    const balancePath = `${chainPath}/accounts/${accountPath}/balance`
    const balance = parseInt(execSync(`cat ${balancePath}`).toString())

    if (balance === NaN) return

    execSync(`echo ${balance + REWARD} > ${balancePath}`)
    execSync(`${chainGit} add .`)
    execSync(`${chainGit} commit -S -m '${generateCommitMessage(0)}'`)

    let i = 1
    while (true) {
      const commitMessage = generateCommitMessage(i++)
      execSync(`${chainGit} commit --amend -S -m '${commitMessage}'`)
      const commitHash = execSync(`${chainGit} rev-parse HEAD`).toString()
      log(`${commitMessage}: ${commitHash}`)

      if (commitHash.substring(0, 2) === '55') {
        break
      }
    }

    log('create new block!')
    execSync(`${chainGit} push`)
  } catch (error) {
    log(error)
    throw error
  }
}

run()
