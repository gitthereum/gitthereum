const Argv = require('minimist')(process.argv.slice(2), {'--': true})

const Client = require('../client')

const client = new Client(Argv['path'])

async function run() {
    await client.transfer(Argv['to'], Argv['_'][0],Argv['fee'] || 100)
}
run()