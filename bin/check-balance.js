const Argv = require('minimist')(process.argv.slice(2), {'--': true})

const Client = require('../client')

const client = new Client(Argv['path'])

async function run() {
    const balance = await client.getBalance(Argv['_'][0])
    console.log(balance)
}
run()