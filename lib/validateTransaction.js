function validateTransaction({ to, amount, fee }, senderBalance) {
  // TODO: check if transaction fee is number
  if (fee && typeof fee !== 'number') return false
  // TODO: check if transaction fee is not negative value
  if (fee < 0) return false
  // TODO: check if transaction amount is number
  if (typeof amount !== 'number') return false
  // TODO: check if transaction amount is not negative value
  if (amount < 0) return false
  // TODO: check if balance is not negative value
  if (senderBalance < 0) return false
  // TODO: check if account's balance has enough money to transfer
  if (senderBalance < amount) return false
  // TODO: check if amount is positive value
  return true
}

module.exports = validateTransaction
