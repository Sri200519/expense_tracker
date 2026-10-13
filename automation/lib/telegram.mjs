import { telegramConfig } from "./config.mjs"
import { categoryNames } from "./categories.mjs"

async function telegramRequest(method, body, { optional = false } = {}) {
  const config = telegramConfig({ optional })
  if (!config) return null

  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram ${method} failed: ${data.description || `HTTP ${response.status}`}`)
  }
  return data.result
}

export async function sendTransactionReview({
  merchant,
  amount,
  itemLabel,
  date,
  category,
  categoryNeedsReview,
  pending,
  postedFromPending,
}) {
  const config = telegramConfig({ optional: true })
  if (!config) return null

  const sign = amount < 0 ? "-$" : "$"
  const displayedAmount = `${sign}${Math.abs(amount).toFixed(2)}`
  const heading = pending ? "Pending transaction" : postedFromPending ? "Expense posted" : "New posted transaction"
  const text = [
    `${heading}: ${merchant}`,
    `${itemLabel} • ${date} • ${displayedAmount}`,
    `Category: ${category}${categoryNeedsReview ? " (please confirm)" : ""}`,
    "",
    categoryNeedsReview
      ? "I am not confident about the category. Reply with: amount | category"
      : "Reply with your exact amount. To correct the category, use: amount | category",
    categoryNeedsReview
      ? `Example: 12.50 | Groceries\nCategories: ${categoryNames().join(", ")}`
      : "Examples: 12.50, $12.50, 0, or 12.50 | Food",
  ].join("\n")

  return telegramRequest("sendMessage", { chat_id: config.chatId, text })
}

export async function getTelegramUpdates() {
  const config = telegramConfig({ optional: false })
  return telegramRequest("getUpdates", {
    timeout: 0,
    limit: 100,
    allowed_updates: ["message"],
  })
}

export async function acknowledgeTelegramUpdates(lastUpdateId) {
  if (lastUpdateId === undefined || lastUpdateId === null) return
  await telegramRequest("getUpdates", {
    offset: lastUpdateId + 1,
    timeout: 0,
    limit: 1,
    allowed_updates: ["message"],
  })
}

export async function sendTelegramConfirmation(text, replyToMessageId) {
  const { chatId } = telegramConfig({ optional: false })
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true },
  })
}

export function configuredTelegramChatId() {
  return String(telegramConfig({ optional: false }).chatId)
}
