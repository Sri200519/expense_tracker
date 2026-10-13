const INCOMING_VENMO_TEXT = /\b(received|payment from|paid you|cashout|cash out|transfer from)\b/i
const REFUND_TEXT = /\b(refund|refunded|reversal|reversed|chargeback)\b/i

export function shouldIncludeTransaction(transaction, itemLabel) {
  const amount = Number(transaction.amount)
  if (!Number.isFinite(amount)) return false

  const primary = transaction.personal_finance_category?.primary || ""
  const detail = transaction.personal_finance_category?.detailed || ""
  const description = [transaction.merchant_name, transaction.name].filter(Boolean).join(" ")
  const isVenmo = itemLabel.toLowerCase() === "venmo"

  if (isVenmo) {
    if (amount >= 0) return true
    if (REFUND_TEXT.test(description)) return true
    if (primary === "TRANSFER_IN" || primary === "INCOME") return false
    if (INCOMING_VENMO_TEXT.test(description)) return false
    // Other negative Venmo amounts retain their merchant category and are
    // treated as refunds. The original amount remains visible for review.
    return true
  }

  if (primary === "TRANSFER_IN" || primary === "TRANSFER_OUT" || primary === "INCOME") return false
  if (primary === "LOAN_PAYMENTS" || detail === "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT") return false
  return true
}

function normalizedOwner(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function isAllowedAmexCardholder(transaction, itemLabel, allowedOwner) {
  if (itemLabel !== "American Express") return true
  const expected = normalizedOwner(allowedOwner)
  if (!expected) return true

  const actual = normalizedOwner(transaction.account_owner)
  if (!actual) return false

  const expectedTokens = expected.split(/\s+/).filter(Boolean)
  return expectedTokens.every((token) => actual.split(/\s+/).includes(token))
}

export function isOnOrAfterImportDate(transaction, importStartDate) {
  const effectiveDate = transaction.date || transaction.authorized_date
  return Boolean(effectiveDate && effectiveDate >= importStartDate)
}

export function isVenmoFundingDuplicate(transaction, venmoTransactions) {
  const description = [transaction.merchant_name, transaction.name].filter(Boolean).join(" ")
  if (!/\bvenmo\b/i.test(description)) return false

  const transactionTime = Date.parse(`${transaction.date}T00:00:00Z`)
  if (!Number.isFinite(transactionTime)) return false

  return venmoTransactions.some((venmoTransaction) => {
    const venmoTime = Date.parse(`${venmoTransaction.date}T00:00:00Z`)
    const closeInTime = Math.abs(transactionTime - venmoTime) <= 3 * 24 * 60 * 60 * 1000
    const sameAmount = Math.abs(Number(transaction.amount) - Number(venmoTransaction.amount)) < 0.005
    return closeInTime && sameAmount
  })
}
