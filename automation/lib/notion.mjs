import { notionConfig } from "./config.mjs"

const NOTION_VERSION = "2022-06-28"

function richText(content) {
  return content
    ? { rich_text: [{ type: "text", text: { content: String(content).slice(0, 2000) } }] }
    : { rich_text: [] }
}

function title(content) {
  return { title: [{ type: "text", text: { content: String(content || "Unknown").slice(0, 2000) } }] }
}

async function notionRequest(path, { method = "GET", body } = {}) {
  const { apiKey } = notionConfig()
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(`Notion ${method} ${path} failed: ${data.message || `HTTP ${response.status}`}`)
  }
  return data
}

export async function ensureExpenseSchema() {
  const { databaseId } = notionConfig()
  const database = await notionRequest(`/databases/${databaseId}`)
  const existing = database.properties || {}
  const additions = {}

  if (!existing["Statement Amount"]) additions["Statement Amount"] = { number: { format: "dollar" } }
  if (!existing["Plaid Transaction ID"]) additions["Plaid Transaction ID"] = { rich_text: {} }
  if (!existing["Plaid Account ID"]) additions["Plaid Account ID"] = { rich_text: {} }
  if (!existing["Plaid Item"]) additions["Plaid Item"] = { rich_text: {} }
  if (!existing.Source) {
    additions.Source = {
      select: { options: [{ name: "Plaid", color: "blue" }, { name: "Manual", color: "gray" }] },
    }
  }
  if (!existing.Pending) additions.Pending = { checkbox: {} }
  if (!existing["Review Status"]) {
    additions["Review Status"] = {
      select: {
        options: [
          { name: "Awaiting reply", color: "yellow" },
          { name: "Reviewed", color: "green" },
          { name: "Notification not sent", color: "gray" },
        ],
      },
    }
  }
  if (!existing["Telegram Message ID"]) additions["Telegram Message ID"] = { number: {} }

  const paymentOptions = existing["Payment Method"]?.select?.options || []
  const missingPaymentOptions = ["Capital One", "American Express", "Venmo"].filter(
    (name) => !paymentOptions.some((option) => option.name === name),
  )
  if (existing["Payment Method"] && missingPaymentOptions.length > 0) {
    additions["Payment Method"] = {
      select: {
        options: [
          ...paymentOptions.map(({ name, color }) => ({ name, color })),
          ...missingPaymentOptions.map((name) => ({ name, color: "default" })),
        ],
      },
    }
  }

  const categoryOptions = existing.Category?.select?.options || []
  const expectedCategories = ["Food", "Shopping", "School", "Transport", "Entertainment", "Paraphernalia", "Groceries", "Other"]
  const missingCategories = expectedCategories.filter(
    (name) => !categoryOptions.some((option) => option.name === name),
  )
  if (existing.Category && missingCategories.length > 0) {
    additions.Category = {
      select: {
        options: [
          ...categoryOptions.map(({ name, color }) => ({ name, color })),
          ...missingCategories.map((name) => ({ name, color: "default" })),
        ],
      },
    }
  }

  if (Object.keys(additions).length > 0) {
    await notionRequest(`/databases/${databaseId}`, {
      method: "PATCH",
      body: { properties: additions },
    })
  }

  return Object.keys(additions)
}

export async function listPlaidExpenses() {
  const { databaseId } = notionConfig()
  const pages = []
  let cursor

  do {
    const body = {
      page_size: 100,
      filter: { property: "Plaid Transaction ID", rich_text: { is_not_empty: true } },
    }
    if (cursor) body.start_cursor = cursor

    const data = await notionRequest(`/databases/${databaseId}/query`, { method: "POST", body })
    pages.push(...data.results)
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)

  return pages
}

export function pageText(property) {
  if (!property) return ""
  const values = property.rich_text || property.title || []
  return values.map((value) => value.plain_text || "").join("")
}

export function pageSelect(property) {
  return property?.select?.name || ""
}

export function pageNumber(property) {
  return typeof property?.number === "number" ? property.number : null
}

export function plaidTransactionId(page) {
  return pageText(page.properties?.["Plaid Transaction ID"])
}

export function telegramMessageId(page) {
  return pageNumber(page.properties?.["Telegram Message ID"])
}

export function transactionProperties({
  transaction,
  account,
  itemLabel,
  category,
  preservePersonalAmount = false,
  includeNotes = true,
}) {
  const merchant = transaction.merchant_name || transaction.name || "Unknown"
  const pfc = transaction.personal_finance_category
  const accountName = account?.official_name || account?.name || itemLabel
  const mask = account?.mask ? ` ••••${account.mask}` : ""
  const notes = [
    pfc?.primary ? `Plaid category: ${pfc.primary}` : null,
    pfc?.detailed ? `Plaid detail: ${pfc.detailed}` : null,
    accountName ? `Account: ${accountName}${mask}` : null,
  ]
    .filter(Boolean)
    .join(" | ")

  const properties = {
    Date: { date: { start: transaction.date } },
    Merchant: title(merchant),
    "Statement Amount": { number: transaction.amount },
    Category: { select: { name: category } },
    "Payment Method": { select: { name: itemLabel } },
    "Plaid Transaction ID": richText(transaction.transaction_id),
    "Plaid Account ID": richText(transaction.account_id),
    "Plaid Item": richText(itemLabel),
    Source: { select: { name: "Plaid" } },
    Pending: { checkbox: Boolean(transaction.pending) },
    "Auto-Detected": { checkbox: true },
  }

  if (!preservePersonalAmount) properties["Total Amount"] = { number: transaction.amount }
  if (includeNotes && notes) properties.Notes = richText(notes)
  return properties
}

export async function createExpense(properties) {
  const { databaseId } = notionConfig()
  return notionRequest("/pages", {
    method: "POST",
    body: { parent: { database_id: databaseId }, properties },
  })
}

export async function updateExpense(pageId, properties) {
  return notionRequest(`/pages/${pageId}`, { method: "PATCH", body: { properties } })
}

export async function archiveExpense(pageId) {
  return notionRequest(`/pages/${pageId}`, { method: "PATCH", body: { archived: true } })
}

export async function markNotification(pageId, messageId) {
  return updateExpense(pageId, {
    "Telegram Message ID": { number: messageId },
    "Review Status": { select: { name: "Awaiting reply" } },
  })
}

export async function markNotificationMissing(pageId) {
  return updateExpense(pageId, {
    "Review Status": { select: { name: "Notification not sent" } },
  })
}

export async function applyPersonalAmount(pageId, amount, existingNotes) {
  const reviewLine = `Your share confirmed from Telegram: $${amount.toFixed(2)}`
  const notes = existingNotes ? `${existingNotes}\n${reviewLine}` : reviewLine
  return updateExpense(pageId, {
    "Total Amount": { number: amount },
    "Review Status": { select: { name: "Reviewed" } },
    Notes: richText(notes),
  })
}
