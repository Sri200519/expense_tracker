import test from "node:test"
import assert from "node:assert/strict"
import { parseAmount, signedShare } from "../process-telegram-replies.mjs"

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
