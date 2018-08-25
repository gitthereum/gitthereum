const path = require('path')
const Client = require('./client')


;(async () => {
    // const client = new Client(path.resolve(__dirname, '../chain'))
    const client = new Client(path.resolve(__dirname, '../real-chain'), {
        env: {
            'GNUPGHOME': path.resolve(__dirname, '../keys')
        }
    })
    const result = await client._lsFiles()
    console.log(result)

    // const result2 = await client._execGPG('--homedir ../keys --list-keys')
    // console.log(result2)

    const result3 = await client._exec('echo $GNUPGHOME')
    console.log(result3)

    // const balance = await client.getBalance('0AC51CBC5C8832457EDB42F334B0AF0B3E84D636')
    const balance = await client.getBalance('34B0/AF0B/3E84/D636')
    console.log(balance)

    const commitHash = await client.transfer('5186/4AC2/67B5/13AE', 422);
    console.log(commitHash)
})()

