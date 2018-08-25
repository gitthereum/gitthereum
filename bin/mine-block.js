const Argv = require('minimist')(process.argv.slice(2), { '--': true })
const { execSync } = require('child_process')

const chainPath = Argv['path']

function run() {
  try {
    const chainGit = `git -C ${chainPath}`
    execSync(`${chainGit} pull`)
    execSync('export GPG_TTY=$(tty)')

    const blockNumber = parseInt(
      execSync(`${chainGit} log -1 --pretty=%B`)
        .toString()
        .replace(/block (\d+) \[nonce=\d+]/g, '$1')
    )

    // TODO: GET SOME MONEY!
    // Commit nonce=0

    let i = 1
    while (true) {
      const commitMessage = `block ${blockNumber} [nonce=${i++}]`
      execSync(`${chainGit} commit --amend -S -m '${commitMessage}'`)
      const commitHash = execSync(`${chainGit} rev-parse HEAD`).toString()
      console.log('commitHash', commitHash)

      if (commitHash.substring(0, 2) === '55') {
        break
      }
    }

    execSync(`${chainGit} push`)
  } catch (error) {
    console.log(error)
    throw error
  }
}

run()
