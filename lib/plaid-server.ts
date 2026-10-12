import "server-only"

function plaidBaseUrl() {
  const environment = (process.env.PLAID_ENV || "production").toLowerCase()
  const hosts: Record<string, string> = {
    sandbox: "https://sandbox.plaid.com",
    development: "https://development.plaid.com",
    production: "https://production.plaid.com",
  }
  const host = hosts[environment]
  if (!host) throw new Error("PLAID_ENV must be sandbox, development, or production")
  return host
}

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

async function plaidRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${plaidBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: required("PLAID_CLIENT_ID"),
      secret: required("PLAID_SECRET"),
      ...body,
    }),
    cache: "no-store",
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error_message || data.display_message || data.error_code || `Plaid HTTP ${response.status}`)
  }
  return data
}

export async function createPlaidLinkToken() {
  return plaidRequest("/link/token/create", {
    user: { client_user_id: "expense-tracker-owner" },
    client_name: "Expense Tracker",
    products: ["transactions"],
    transactions: { days_requested: 730 },
    country_codes: ["US"],
    language: "en",
  })
}

export async function exchangePlaidPublicToken(publicToken: string) {
  return plaidRequest("/item/public_token/exchange", { public_token: publicToken })
}

export async function getPlaidAccounts(accessToken: string) {
  return plaidRequest("/accounts/get", { access_token: accessToken })
}

export function validateSetupPassphrase(value: string | null) {
  const expected = required("APP_PASSPHRASE")
  return Boolean(value) && value === expected
}
