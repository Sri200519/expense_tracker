const REQUIRED_PLAID_ITEMS = [
  ["Capital One", "PLAID_ACCESS_TOKEN_CAPITAL_ONE"],
  ["American Express", "PLAID_ACCESS_TOKEN_AMEX"],
  ["Venmo", "PLAID_ACCESS_TOKEN_VENMO"],
]

export function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function plaidBaseUrl() {
  const environment = (process.env.PLAID_ENV || "production").toLowerCase()
  const hosts = {
    sandbox: "https://sandbox.plaid.com",
    development: "https://development.plaid.com",
    production: "https://production.plaid.com",
  }

  const host = hosts[environment]
  if (!host) {
    throw new Error("PLAID_ENV must be sandbox, development, or production")
  }
  return host
}

export function configuredPlaidItems() {
  const items = REQUIRED_PLAID_ITEMS.flatMap(([label, variable]) => {
    const accessToken = process.env[variable]?.trim()
    return accessToken ? [{ label, accessToken, variable }] : []
  })

  if (items.length === 0) {
    throw new Error(
      "No Plaid Items configured. Add at least one PLAID_ACCESS_TOKEN_CAPITAL_ONE, PLAID_ACCESS_TOKEN_AMEX, or PLAID_ACCESS_TOKEN_VENMO secret.",
    )
  }

  return items
}

export function notionConfig() {
  return {
    apiKey: requireEnv("NOTION_API_KEY"),
    databaseId: requireEnv("NOTION_DATABASE_ID"),
  }
}

export function telegramConfig({ optional = true } = {}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim()

  if (!botToken || !chatId) {
    if (optional) return null
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required")
  }

  return { botToken, chatId }
}
