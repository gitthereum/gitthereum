function getContract(accountId) {
  try {
    return require(`./accounts/${accountId}/contract.js`)
  } catch (error) {
    return null
  }
}

module.exports = getContract
