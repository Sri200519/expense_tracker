import test from "node:test"
import assert from "node:assert/strict"
import { categorizeTransaction, categorizeTransactionDecision } from "../lib/categories.mjs"

test("maps Plaid grocery detail to Groceries", () => {
  assert.equal(
    categorizeTransaction({
      name: "MARKET",
      personal_finance_category: {
        primary: "FOOD_AND_DRINK",
        detailed: "FOOD_AND_DRINK_GROCERIES",
      },
    }),
    "Groceries",
  )
})

test("maps transportation categories", () => {
  assert.equal(
    categorizeTransaction({
      name: "MBTA",
      personal_finance_category: { primary: "TRANSPORTATION", detailed: "TRANSPORTATION_PUBLIC_TRANSIT" },
    }),
    "Transport",
  )
})

test("merchant overrides win over Plaid categories", () => {
  const previous = process.env.CATEGORY_OVERRIDES_JSON
  process.env.CATEGORY_OVERRIDES_JSON = JSON.stringify([{ match: "campus store", category: "School" }])
  try {
    assert.equal(
      categorizeTransaction({
        merchant_name: "UMass Campus Store",
        personal_finance_category: { primary: "GENERAL_MERCHANDISE" },
      }),
      "School",
    )
  } finally {
    if (previous === undefined) delete process.env.CATEGORY_OVERRIDES_JSON
    else process.env.CATEGORY_OVERRIDES_JSON = previous
  }
})

test("known merchants use the matching Notion category", () => {
  assert.deepEqual(
    categorizeTransactionDecision({ merchant_name: "Market Basket #42" }),
    { category: "Groceries", needsReview: false, source: "merchant" },
  )
})

test("unknown and low-confidence categories require Telegram review", () => {
  assert.equal(categorizeTransactionDecision({ name: "MYSTERY PURCHASE" }).needsReview, true)
  assert.deepEqual(
    categorizeTransactionDecision({
      name: "Cafe",
      personal_finance_category: {
        primary: "FOOD_AND_DRINK",
        detailed: "FOOD_AND_DRINK_RESTAURANT",
        confidence_level: "LOW",
      },
    }),
    { category: "Food", needsReview: true, source: "plaid_detail" },
  )
})
