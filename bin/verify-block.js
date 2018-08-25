const argv = require('minimist')(process.argv.slice(2))
const childProcess = require('child_process')

async function main() {
  // Make unhandled rejections crash Node process.
  process.on('unhandledRejection', up => {
    throw up
  })

  const resolveSha = ref => childProcess.execFileSync('git', ['rev-parse', ref])
  const targetState = argv._[0] || 'master'
  const targetCommit = resolveSha(targetState)
  const knownState = argv.knownState
  const knownCommit = knownState && resolveSha(knownState)
  const pointer = (state, commit) =>
    state === commit ? commit : `${state} => ${commit}`
  console.log('* Going to check', pointer(targetState, targetCommit))
  if (knownCommit) {
    console.log('* Assuming checked commit', pointer(knownState, knownCommit))
  } else {
    console.log('* Checking all the way to the genesis block!')
  }
}

main()
