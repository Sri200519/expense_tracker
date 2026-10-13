import test from "node:test"
import assert from "node:assert/strict"
import { normalizeCategory, parseAmount, parseReviewReply, signedShare } from "../process-telegram-replies.mjs"

test("parses common amount replies", () => {
  assert.equal(parseAmount("$12.50"), 12.5)
  assert.equal(parseAmount("1,234.56"), 1234.56)
  assert.equal(parseAmount("0"), 0)
})

test("rejects ambiguous reply text", () => {
  assert.equal(parseAmount("mine is 12.50"), null)
  assert.equal(parseAmount("12.345"), null)
})

test("inherits refund sign when a positive share is supplied", () => {
  assert.equal(signedShare(5, -10), -5)
  assert.equal(signedShare(5, 10), 5)
})

test("parses amount plus a Notion category", () => {
  assert.deepEqual(parseReviewReply("$12.50 | groceries"), {
    amount: 12.5,
    useFullAmount: false,
    categoryProvided: true,
    category: "Groceries",
  })
  assert.equal(normalizeCategory("transport"), "Transport")
})

test("flags an unknown supplied category", () => {
  assert.deepEqual(parseReviewReply("4 | Pets"), {
    amount: 4,
    useFullAmount: false,
    categoryProvided: true,
    category: null,
  })
})

test("uses all for the complete statement amount", () => {
  assert.deepEqual(parseReviewReply("all"), {
    amount: null,
    useFullAmount: true,
    categoryProvided: false,
    category: null,
  })
  assert.deepEqual(parseReviewReply("ALL | food"), {
    amount: null,
    useFullAmount: true,
    categoryProvided: true,
    category: "Food",
  })
})
