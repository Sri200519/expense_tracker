import {
  applyPersonalReview,
  excludeExpense,
  listPlaidExpenses,
  pageCheckbox,
  pageNumber,
  pageSelect,
  pageText,
  telegramMessageId,
} from "./lib/notion.mjs"
import { pathToFileURL } from "node:url"
import { categoryNames } from "./lib/categories.mjs"
import {
  acknowledgeTelegramUpdates,
  configuredTelegramChatId,
  getTelegramUpdates,
  sendTelegramConfirmation,
} from "./lib/telegram.mjs"

const WRITE_DELAY_MS = 350
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export function parseAmount(text) {
  const normalized = String(text || "").trim().replace(/[$,]/g, "")
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}

export function normalizeCategory(value) {
  const wanted = String(value || "").trim().toLowerCase()
  return categoryNames().find((category) => category.toLowerCase() === wanted) || null
}

export function parseReviewReply(text) {
  const parts = String(text || "").split("|")
  if (parts.length > 2) return null
  const amountText = parts[0].trim()
  const useFullAmount = amountText.toLowerCase() === "all"
  const amount = useFullAmount ? null : parseAmount(amountText)
  if (!useFullAmount && amount === null) return null
  const categoryProvided = parts.length === 2 && Boolean(parts[1].trim())
  return {
    amount,
    useFullAmount,
    categoryProvided,
    category: categoryProvided ? normalizeCategory(parts[1]) : null,
  }
}

async function main() {
  const updates = await getTelegramUpdates()
  if (!updates.length) {
    console.log("No Telegram replies to process")
    return
  }

  const pages = await listPlaidExpenses()
  const pagesByMessageId = new Map(
    pages.flatMap((page) => {
      const messageId = telegramMessageId(page)
      return messageId ? [[messageId, page]] : []
    }),
  )
  const allowedChatId = configuredTelegramChatId()
  let processed = 0
  let lastUpdateId

  for (const update of updates) {
    lastUpdateId = Math.max(lastUpdateId ?? update.update_id, update.update_id)
    const message = update.message
    if (!message || String(message.chat?.id) !== allowedChatId) continue

    const repliedToId = message.reply_to_message?.message_id
    if (!repliedToId) {
      await sendTelegramConfirmation(
        "Reply directly to a transaction message with all, 0, or your exact amount, for example 12.50.",
        message.message_id,
      )
      continue
    }

    const page = pagesByMessageId.get(repliedToId)
    if (!page) {
      await sendTelegramConfirmation("I could not match that reply to a transaction. Please reply to the original transaction message.", message.message_id)
      continue
    }

    const parsed = parseReviewReply(message.text)
    if (!parsed) {
      await sendTelegramConfirmation(
        "Reply with all for the full amount, a number such as 12.50, or amount | category.",
        message.message_id,
      )
      continue
    }

    if (parsed.categoryProvided && !parsed.category) {
      await sendTelegramConfirmation(
        `Unknown category. Use one of: ${categoryNames().join(", ")}. Example: 12.50 | Groceries`,
        message.message_id,
      )
      continue
    }

    const statementAmount = pageNumber(page.properties?.["Statement Amount"]) ?? 0
    const amount = parsed.useFullAmount ? statementAmount : parsed.amount

    if (amount === 0) {
      if (pageCheckbox(page.properties?.Excluded)) {
        await sendTelegramConfirmation("This transaction is already excluded from your expense sheet.", message.message_id)
        continue
      }
      const notes = pageText(page.properties?.Notes)
      const merchant = pageText(page.properties?.Merchant) || "transaction"
      await excludeExpense(page.id, notes)
      await sleep(WRITE_DELAY_MS)
      await sendTelegramConfirmation(
        `Removed ${merchant} from your visible expense sheet. It will not be re-imported.`,
        message.message_id,
      )
      processed += 1
      continue
    }

    const categoryNeedsReview = Boolean(page.properties?.["Category Needs Review"]?.checkbox)
    if (categoryNeedsReview && !parsed.category) {
      const amountExample = parsed.useFullAmount ? "all" : Math.abs(parsed.amount).toFixed(2)
      await sendTelegramConfirmation(
        `I need the category too. Reply to the original transaction with: ${amountExample} | category\nCategories: ${categoryNames().join(", ")}`,
        message.message_id,
      )
      continue
    }

    if (
      pageSelect(page.properties?.["Review Status"]) === "Reviewed" &&
      pageNumber(page.properties?.["Total Amount"]) === amount &&
      (!parsed.category || pageSelect(page.properties?.Category) === parsed.category)
    ) {
      await sendTelegramConfirmation(
        `Your $${Math.abs(amount).toFixed(2)} share for this transaction was already saved.`,
        message.message_id,
      )
      continue
    }

    const notes = pageText(page.properties?.Notes)
    await applyPersonalReview(page.id, amount, parsed.category, notes)
    await sleep(WRITE_DELAY_MS)

    const merchant = pageText(page.properties?.Merchant) || "transaction"
    await sendTelegramConfirmation(
      `Saved $${Math.abs(amount).toFixed(2)} as your share for ${merchant}${parsed.category ? ` in ${parsed.category}` : ""}.`,
      message.message_id,
    )
    processed += 1
  }

  await acknowledgeTelegramUpdates(lastUpdateId)
  console.log(`Processed ${processed} Telegram review replies`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
