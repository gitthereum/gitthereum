const Fetcher = require('./git-fetcher')
const path = require('path')
const chalk = require('chalk')
const { execSync } = require('child_process')
const fetcher = new Fetcher(process.cwd(), {
  env: {
    GNUPGHOME: path.resolve(__dirname, '../keys')
  }
})

let ready = true
async function poll() {
  if (!ready) return
  try {
    ready = false
    console.log(`${new Date().toLocaleTimeString()}\tcalling poll()`)
    console.log(chalk.bold.blue('========> Fetching all branches'))
    await fetcher.fetchAll()
    console.log(chalk.bold.blue('========> Checking master branch heights'))
    result = {}
    const masters = await fetcher.listMasterBranches()
    console.log(masters)
    const getBranchHeight = async branch => {
      const height = await fetcher.getBlockHeightOfBranch(branch)
      return { branch, height }
    }
    const branchesWithHeights = await Promise.all(
      masters.map(master => getBranchHeight(master))
    )
    const localMasterBranchWithHeight = await fetcher.getBlockHeightOfBranch('master')
    const validBranchesWithHeights = []
    const validShas = new Set()
    const invalidShas = new Set()
    console.log(chalk.bold.blue('========> Verifying remote master branches'))
    for (const { branch, height } of branchesWithHeights) {
      const sha = execSync(`git rev-parse ${branch}`)
        .toString()
        .trim()
      let valid = validShas.has(sha)
      if (!valid) {
        if (!invalidShas.has(sha) && height > 0) {
          try {
            console.log(
              chalk.bold.blue(
                '======> Checking ' + branch + ' [' + sha + '] for validity'
              )
            )
            execSync(
              `node '${require.resolve(
                './bin/verify-block'
              )}' --knownState='master' '${sha}'`,
              { stdio: 'inherit' }
            )
            valid = true
            validShas.add(sha)
          } catch (e) {
            invalidShas.add(sha)
          }
        }
      }
      if (valid) validBranchesWithHeights.push({ branch, height, sha })
    }
    console.log('Branches to check:', validBranchesWithHeights)
    console.log()
    const highestBranch = validBranchesWithHeights.reduce(
      (acc, val) => (val.height > acc.height ? val : acc),
      { branch: 'master', height: localMasterBranchWithHeight }
    )
    console.log('Highest branch:', highestBranch)
    if (highestBranch.branch !== 'master') {
      console.log(
        chalk.bold.blue(
          '========> Adopting branch ' +
            highestBranch.branch +
            ' [' +
            highestBranch.sha +
            ']'
        )
      )
      const currentBranch = await fetcher._execGit(`rev-parse --abbrev-ref HEAD`)
      if (currentBranch !== 'master') {
        await fetcher._execGit(`checkout -f master`)
      }
      const [remote, branch] = highestBranch.branch.split('/')
      if (process.env.SAFE == 1) {
        console.log(`SAFE is true, reset ${remote} ${branch} is not executed`)
      } else {
        console.log(`SAFE is not true, actually executing reset ${remote} ${branch}`)
        await fetcher._execGit(`reset --hard ${remote}/${branch}`)
      }
    }
    console.log(chalk.bold.blue('========> Mining a new block'))
    execSync(`node ${require.resolve('./bin/mine-block')}`, { stdio: 'inherit' })
  } catch (e) {
    console.error(chalk.bold.red('[ERROR] Iteration failed !!'), e.stack)
    throw e
  } finally {
    ready = true
  }
}

const poller = setInterval(poll, process.env.INTERVAL || 10000)

process.on('SIGINT', () => {
  clearInterval(poller)
})
module.exports = poll

poll()
