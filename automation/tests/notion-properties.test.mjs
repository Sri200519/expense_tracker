import test from "node:test"
import assert from "node:assert/strict"
import { paymentMethodForItem, transactionProperties } from "../lib/notion.mjs"

test("stores card issuers under the Card payment method", () => {
  assert.equal(paymentMethodForItem("American Express"), "Card")
  assert.equal(paymentMethodForItem("Capital One"), "Card")
  assert.equal(paymentMethodForItem("Venmo"), "Venmo")
})

test("leaves Total Amount empty until the Telegram reply", () => {
  const properties = transactionProperties({
    transaction: {
      transaction_id: "transaction-1",
      account_id: "account-1",
      date: "2026-10-12",
      amount: 42,
      name: "Example Merchant",
      pending: false,
    },
    itemLabel: "American Express",
    category: "Other",
  })

  assert.deepEqual(properties["Total Amount"], { number: null })
  assert.deepEqual(properties["Statement Amount"], { number: 42 })
  assert.deepEqual(properties["Payment Method"], { select: { name: "Card" } })
  assert.deepEqual(properties.Excluded, { checkbox: false })
})
