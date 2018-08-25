const Argv = require('minimist')(process.argv.slice(2), {'--': true})
const { execSync } = require('child_process')

function run() {
    execSync(`git clone ${Argv['chaindir'] || 'https://github.com/gitthereum/chain.git'} ${Argv['outdir'] || ''}`)
}
run()