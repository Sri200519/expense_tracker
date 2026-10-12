import { categorizeTransaction } from "./lib/categories.mjs"
import { configuredPlaidItems, telegramConfig } from "./lib/config.mjs"
import {
  archiveExpense,
  createExpense,
  ensureExpenseSchema,
  listPlaidExpenses,
  markNotification,
  markNotificationMissing,
  pageNumber,
  pageSelect,
  pageText,
  plaidTransactionId,
  transactionProperties,
  updateExpense,
} from "./lib/notion.mjs"
import { fetchTransactions } from "./lib/plaid.mjs"
import { sendTransactionReview } from "./lib/telegram.mjs"
import {
  isOnOrAfterImportDate,
  isVenmoFundingDuplicate,
  shouldIncludeTransaction,
} from "./lib/transaction-filter.mjs"

const DAY_MS = 24 * 60 * 60 * 1000
const WRITE_DELAY_MS = 350

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function dateString(date) {
  const timeZone = process.env.EXPENSE_TIME_ZONE || "America/New_York"
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function accountMap(accounts) {
  return new Map(accounts.map((account) => [account.account_id, account]))
}

function differs(page, transaction, itemLabel) {
  const properties = page.properties || {}
  return (
    pageNumber(properties["Statement Amount"]) !== transaction.amount ||
    properties.Date?.date?.start !== transaction.date ||
    pageText(properties.Merchant) !== (transaction.merchant_name || transaction.name || "Unknown") ||
    Boolean(properties.Pending?.checkbox) !== Boolean(transaction.pending) ||
    pageText(properties["Plaid Item"]) !== itemLabel
  )
}

async function notifyIfNeeded(page, transaction, itemLabel) {
  const existingMessageId = pageNumber(page.properties?.["Telegram Message ID"])
  if (existingMessageId) return false

  if (!telegramConfig({ optional: true })) {
    if (pageSelect(page.properties?.["Review Status"]) !== "Notification not sent") {
      await markNotificationMissing(page.id)
      await sleep(WRITE_DELAY_MS)
    }
    return false
  }

  const message = await sendTransactionReview({
    merchant: transaction.merchant_name || transaction.name || "Unknown",
    amount: transaction.amount,
    itemLabel,
    date: transaction.date,
  })
  await markNotification(page.id, message.message_id)
  await sleep(WRITE_DELAY_MS)
  return true
}

async function main() {
  const addedColumns = await ensureExpenseSchema()
  if (addedColumns.length > 0) console.log(`Added Notion fields: ${addedColumns.join(", ")}`)

  const existingPages = await listPlaidExpenses()
  const pagesByTransactionId = new Map(existingPages.map((page) => [plaidTransactionId(page), page]))
  const items = configuredPlaidItems()
  const importStartDate = process.env.PLAID_IMPORT_START_DATE?.trim() || dateString(new Date())
  if (!/^\d{4}-\d{2}-\d{2}$/.test(importStartDate)) {
    throw new Error("PLAID_IMPORT_START_DATE must use YYYY-MM-DD format")
  }
  const endDate = dateString(new Date())
  const rollingStartDate = dateString(new Date(Date.now() - 45 * DAY_MS))
  const startDate = importStartDate > rollingStartDate ? importStartDate : rollingStartDate

  const summary = { created: 0, updated: 0, archivedPending: 0, notified: 0, unchanged: 0 }

  const itemResults = []
  for (const item of items) {
    console.log(`Syncing ${item.label} from ${startDate} through ${endDate}`)
    const { accounts, transactions } = await fetchTransactions(item.accessToken, startDate, endDate)
    itemResults.push({ item, accounts, transactions })
  }

  const venmoTransactions = itemResults
    .filter(({ item }) => item.label === "Venmo")
    .flatMap(({ transactions }) => transactions)
    .filter(
      (transaction) =>
        isOnOrAfterImportDate(transaction, importStartDate) && shouldIncludeTransaction(transaction, "Venmo"),
    )

  for (const { item, accounts, transactions } of itemResults) {
    const accountsById = accountMap(accounts)

    for (const transaction of transactions) {
      if (!isOnOrAfterImportDate(transaction, importStartDate)) continue
      if (!shouldIncludeTransaction(transaction, item.label)) continue
      if (item.label !== "Venmo" && isVenmoFundingDuplicate(transaction, venmoTransactions)) continue

      if (transaction.pending_transaction_id) {
        const pendingPage = pagesByTransactionId.get(transaction.pending_transaction_id)
        if (pendingPage && !pendingPage.archived) {
          await archiveExpense(pendingPage.id)
          pendingPage.archived = true
          summary.archivedPending += 1
          await sleep(WRITE_DELAY_MS)
        }
      }

      const category = categorizeTransaction(transaction)
      let page = pagesByTransactionId.get(transaction.transaction_id)

      if (!page) {
        page = await createExpense({
          ...transactionProperties({
            transaction,
            account: accountsById.get(transaction.account_id),
            itemLabel: item.label,
            category,
          }),
          "Review Status": { select: { name: telegramConfig({ optional: true }) ? "Awaiting reply" : "Notification not sent" } },
        })
        pagesByTransactionId.set(transaction.transaction_id, page)
        summary.created += 1
        await sleep(WRITE_DELAY_MS)
      } else if (differs(page, transaction, item.label)) {
        const reviewed = pageSelect(page.properties?.["Review Status"]) === "Reviewed"
        page = await updateExpense(
          page.id,
          transactionProperties({
            transaction,
            account: accountsById.get(transaction.account_id),
            itemLabel: item.label,
            category: pageSelect(page.properties?.Category) || category,
            preservePersonalAmount: reviewed,
            includeNotes: false,
          }),
        )
        pagesByTransactionId.set(transaction.transaction_id, page)
        summary.updated += 1
        await sleep(WRITE_DELAY_MS)
      } else {
        summary.unchanged += 1
      }

      try {
        if (await notifyIfNeeded(page, transaction, item.label)) summary.notified += 1
      } catch (error) {
        console.warn(`Notification failed for ${transaction.transaction_id}: ${error.message}`)
      }
    }
  }

  console.log(`Sync complete: ${JSON.stringify(summary)}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
