const path = require('path')
function getContract(accountId) {
  try {
    return require(path.resolve(process.cwd(), `./accounts/${accountId}/contract.js`))
  } catch (error) {
    return null
  }
}

module.exports = getContract
