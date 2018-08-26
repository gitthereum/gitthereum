// const Argv = require('minimist')(process.argv.slice(2), { '--': true })
const path = require('path')

const Client = require('../client')

// const client = new Client(Argv['path'])
const client = new Client(path.resolve(__dirname, '../../chain'))

async function run() {
  const txHash = await client.createContract('52B8/81B1/3EE1/12A3')
  await client.pushTransactionToRemote(txHash)
}

run()
