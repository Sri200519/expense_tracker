import { plaidBaseUrl, requireEnv } from "./config.mjs"

async function plaidRequest(path, body) {
  const response = await fetch(`${plaidBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("PLAID_CLIENT_ID"),
      secret: requireEnv("PLAID_SECRET"),
      ...body,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    const message = data.error_message || data.display_message || data.error_code || `HTTP ${response.status}`
    const error = new Error(`Plaid ${path} failed: ${message}`)
    error.code = data.error_code
    error.type = data.error_type
    throw error
  }

  return data
}

export async function fetchAccounts(accessToken) {
  const data = await plaidRequest("/accounts/get", { access_token: accessToken })
  return data.accounts || []
}

export async function fetchTransactions(accessToken, startDate, endDate) {
  const count = 500
  let offset = 0
  let total = Number.POSITIVE_INFINITY
  const transactions = []
  let accounts = []

  while (offset < total) {
    const data = await plaidRequest("/transactions/get", {
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: {
        count,
        offset,
        include_original_description: true,
      },
    })

    transactions.push(...(data.transactions || []))
    accounts = data.accounts || accounts
    total = data.total_transactions || transactions.length
    offset = transactions.length

    if ((data.transactions || []).length === 0) break
  }

  return { accounts, transactions }
}

export async function createLinkToken() {
  return plaidRequest("/link/token/create", {
    user: { client_user_id: "expense-tracker-owner" },
    client_name: "Expense Tracker",
    products: ["transactions"],
    transactions: { days_requested: 730 },
    country_codes: ["US"],
    language: "en",
  })
}

export async function exchangePublicToken(publicToken) {
  return plaidRequest("/item/public_token/exchange", { public_token: publicToken })
}
