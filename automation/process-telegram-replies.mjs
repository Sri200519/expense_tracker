import { pageNumber, pageText, listPlaidExpenses, telegramMessageId, applyPersonalAmount } from "./lib/notion.mjs"
import { pathToFileURL } from "node:url"
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

export function signedShare(replyAmount, statementAmount) {
  if (statementAmount < 0 && replyAmount > 0) return -replyAmount
  return replyAmount
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
      await sendTelegramConfirmation("Reply directly to a transaction message with an amount, for example 12.50.", message.message_id)
      continue
    }

    const page = pagesByMessageId.get(repliedToId)
    if (!page) {
      await sendTelegramConfirmation("I could not match that reply to a transaction. Please reply to the original transaction message.", message.message_id)
      continue
    }

    const parsed = parseAmount(message.text)
    if (parsed === null) {
      await sendTelegramConfirmation("Send only an amount, such as 12.50 or 0.", message.message_id)
      continue
    }

    const statementAmount = pageNumber(page.properties?.["Statement Amount"]) ?? 0
    const amount = signedShare(parsed, statementAmount)
    if (Math.abs(amount) > Math.abs(statementAmount)) {
      await sendTelegramConfirmation(
        `Your amount cannot exceed the statement amount of $${Math.abs(statementAmount).toFixed(2)}.`,
        message.message_id,
      )
      continue
    }

    if (
      page.properties?.["Review Status"]?.select?.name === "Reviewed" &&
      pageNumber(page.properties?.["Total Amount"]) === amount
    ) {
      await sendTelegramConfirmation(
        `Your $${Math.abs(amount).toFixed(2)} share for this transaction was already saved.`,
        message.message_id,
      )
      continue
    }

    const notes = pageText(page.properties?.Notes)
    await applyPersonalAmount(page.id, amount, notes)
    await sleep(WRITE_DELAY_MS)

    const merchant = pageText(page.properties?.Merchant) || "transaction"
    await sendTelegramConfirmation(
      `Saved $${Math.abs(amount).toFixed(2)} as your share for ${merchant}.`,
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
