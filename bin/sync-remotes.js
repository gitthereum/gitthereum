const Argv = require('minimist')(process.argv.slice(2), {'--': true})

const poll = require('../poller')

function run() {
    poll()
}
run()
