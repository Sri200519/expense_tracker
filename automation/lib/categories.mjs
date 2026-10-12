const VALID_CATEGORIES = new Set([
  "Food",
  "Shopping",
  "School",
  "Transport",
  "Entertainment",
  "Paraphernalia",
  "Groceries",
  "Other",
])

const PRIMARY_CATEGORY_MAP = {
  ENTERTAINMENT: "Entertainment",
  FOOD_AND_DRINK: "Food",
  GENERAL_MERCHANDISE: "Shopping",
  HOME_IMPROVEMENT: "Shopping",
  TRANSPORTATION: "Transport",
  TRAVEL: "Transport",
}

const DETAIL_CATEGORY_MAP = {
  FOOD_AND_DRINK_GROCERIES: "Groceries",
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: "School",
  TRANSPORTATION_PUBLIC_TRANSIT: "Transport",
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: "Transport",
  TRANSPORTATION_GAS: "Transport",
  ENTERTAINMENT_TV_AND_MOVIES: "Entertainment",
  ENTERTAINMENT_MUSIC_AND_AUDIO: "Entertainment",
}

function configuredOverrides() {
  const raw = process.env.CATEGORY_OVERRIDES_JSON?.trim()
  if (!raw) return []

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("CATEGORY_OVERRIDES_JSON must be valid JSON")
  }

  if (!Array.isArray(parsed)) {
    throw new Error("CATEGORY_OVERRIDES_JSON must be an array")
  }

  return parsed.map((rule, index) => {
    const match = String(rule.match || "").trim().toLowerCase()
    const category = String(rule.category || "").trim()
    if (!match || !VALID_CATEGORIES.has(category)) {
      throw new Error(`Invalid category override at index ${index}`)
    }
    return { match, category }
  })
}

export function categorizeTransaction(transaction) {
  const searchable = [transaction.merchant_name, transaction.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const override = configuredOverrides().find((rule) => searchable.includes(rule.match))
  if (override) return override.category

  const detail = transaction.personal_finance_category?.detailed
  if (detail && DETAIL_CATEGORY_MAP[detail]) return DETAIL_CATEGORY_MAP[detail]

  const primary = transaction.personal_finance_category?.primary
  return PRIMARY_CATEGORY_MAP[primary] || "Other"
}

export function categoryNames() {
  return [...VALID_CATEGORIES]
}
