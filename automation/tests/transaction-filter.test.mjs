import test from "node:test"
import assert from "node:assert/strict"
import {
  isAllowedAmexCardholder,
  isOnOrAfterImportDate,
  isVenmoFundingDuplicate,
  shouldIncludeTransaction,
} from "../lib/transaction-filter.mjs"

test("excludes ordinary credit card payments", () => {
  assert.equal(
    shouldIncludeTransaction(
      {
        amount: -500,
        name: "AUTOPAY PAYMENT",
        personal_finance_category: {
          primary: "LOAN_PAYMENTS",
          detailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
        },
      },
      "American Express",
    ),
    false,
  )
})

test("keeps merchant refunds as negative spending", () => {
  assert.equal(
    shouldIncludeTransaction(
      {
        amount: -18.75,
        merchant_name: "Target",
        personal_finance_category: {
          primary: "GENERAL_MERCHANDISE",
          detailed: "GENERAL_MERCHANDISE_SUPERSTORES",
        },
      },
      "Capital One",
    ),
    true,
  )
})

test("keeps outgoing Venmo payments and removes incoming payments", () => {
  assert.equal(
    shouldIncludeTransaction(
      { amount: 20, name: "Payment to Alex", personal_finance_category: { primary: "TRANSFER_OUT" } },
      "Venmo",
    ),
    true,
  )
  assert.equal(
    shouldIncludeTransaction(
      { amount: -20, name: "Payment from Alex", personal_finance_category: { primary: "TRANSFER_IN" } },
      "Venmo",
    ),
    false,
  )
})

test("keeps explicit Venmo refunds", () => {
  assert.equal(
    shouldIncludeTransaction(
      { amount: -12, name: "Venmo refund", personal_finance_category: { primary: "TRANSFER_IN" } },
      "Venmo",
    ),
    true,
  )
})

test("does not import transactions before the configured first-run date", () => {
  assert.equal(isOnOrAfterImportDate({ date: "2026-10-11" }, "2026-10-12"), false)
  assert.equal(isOnOrAfterImportDate({ date: "2026-10-12" }, "2026-10-12"), true)
})

test("imports only Amex transactions attributed to the configured cardholder", () => {
  assert.equal(
    isAllowedAmexCardholder(
      { account_owner: "Example Person - Card 1007" },
      "American Express",
      "Example Person",
    ),
    true,
  )
  assert.equal(
    isAllowedAmexCardholder(
      { account_owner: "Another Cardholder - Card 2008" },
      "American Express",
      "Example Person",
    ),
    false,
  )
  assert.equal(isAllowedAmexCardholder({}, "American Express", "Example Person"), false)
})

test("does not apply the Amex cardholder filter to other Plaid items", () => {
  assert.equal(isAllowedAmexCardholder({}, "Capital One", "Example Person"), true)
  assert.equal(isAllowedAmexCardholder({}, "Venmo", "Example Person"), true)
})

test("removes a card-side Venmo funding duplicate", () => {
  const cardTransaction = { amount: 24.5, date: "2026-10-12", name: "VENMO *ALEX" }
  const venmoTransactions = [{ amount: 24.5, date: "2026-10-11", name: "Payment to Alex" }]
  assert.equal(isVenmoFundingDuplicate(cardTransaction, venmoTransactions), true)
  assert.equal(
    isVenmoFundingDuplicate({ amount: 20, date: "2026-10-12", name: "Coffee shop" }, venmoTransactions),
    false,
  )
})
