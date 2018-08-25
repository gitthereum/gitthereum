const path = require('path')
const Fetcher = require('./git-fetcher')


;(async () => {
    const fetcher = new Fetcher(path.resolve(__dirname, '../real-chain'), {
        env: {
            'GNUPGHOME': path.resolve(__dirname, '../keys')
        }
    })

    const remotes = await fetcher._listRemotes()
})()

