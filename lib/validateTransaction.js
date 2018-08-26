function validateTransaction(blockNumber, { to, amount, fee }, senderBalance) {
  if (!to.match(/^....\/....\/....\/....$/)) throw new Error('malformed to value')
  // check if transaction fee is number
  if (fee && typeof fee !== 'number') throw new Error('fee is not a number')
  // check if transaction fee is not negative value
  if (fee < 0) throw new Error('fee is negative')
  // check if min transaction fee is more than 100
  if (blockNumber > 3 && fee < 100) throw new Error('fee is too small (minimum 100)')
  // check if transaction amount is number
  if (typeof amount !== 'number') throw new Error('amount is not a number')
  // check if transaction amount is not negative value
  if (amount < 0) throw new Error('amount is negative')
  // check if balance is not negative value
  if (senderBalance < 0) throw new Error('sender’s balance is negative???!!!')
  // check if account's balance has enough money to transfer
  if (senderBalance < amount) throw new Error('insufficient funds')
  // check if amount is positive value
  return true
}

module.exports = validateTransaction
