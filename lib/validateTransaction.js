function validateTransaction(blockNumber, { to, amount, fee }, senderBalance) {
  // check if transaction fee is number
  if (fee && typeof fee !== 'number') return false
  // check if transaction fee is not negative value
  if (fee < 0) return false
  // check if min transaction fee is more than 100
  if (blockNumber > 43 && fee < 100) return false
  // check if transaction amount is number
  if (typeof amount !== 'number') return false
  // check if transaction amount is not negative value
  if (amount < 0) return false
  // check if balance is not negative value
  if (senderBalance < 0) return false
  // check if account's balance has enough money to transfer
  if (senderBalance < amount) return false
  // check if amount is positive value
  return true
}

module.exports = validateTransaction
