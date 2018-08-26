const Argv = require('minimist')(process.argv.slice(2), {'--': true})

const Client = require('../client')

const client = new Client(Argv['path'])

// validate required args just to be safe
if(!Argv['path'] || !Argv['to'] || !Argv['_'][0]) {
    console.error('error: --path, --to, and the argument cannot be falsy')
    process.exit(1)
}

async function run() {
    const txHash = await client.transfer(Argv['to'], Argv['_'][0], Argv['fee'] || 100)
    if(Argv['push']) {
        await client.pushTransactionToRemote(txHash, Argv['remote'] || 'origin')
    } else {
        if(Argv['quiet']) {
            console.log(txHash)
        } else {
            console.log(`transaction created at branch transaction/${txHash}. you still need to manually run git push to publish.`)
        }
    }
}
run()