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

const MERCHANT_CATEGORY_RULES = [
  { pattern: /\b(smoke shop|vape|vaping|dispensary|cannabis|tobacco)\b/i, category: "Paraphernalia" },
  { pattern: /\b(umass|university|college|campus store|bookstore|textbook|chegg)\b/i, category: "School" },
  { pattern: /\b(market basket|trader joe'?s|whole foods|stop\s*&\s*shop|aldi|wegmans)\b/i, category: "Groceries" },
  { pattern: /\b(uber eats|doordash|grubhub)\b/i, category: "Food" },
  { pattern: /\b(uber|lyft|mbta|amtrak)\b/i, category: "Transport" },
  { pattern: /\b(netflix|spotify|hulu|ticketmaster|fandango|cinema|movie theater|steam games)\b/i, category: "Entertainment" },
]

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

function categoryFromDetail(detail) {
  if (!detail) return null
  if (DETAIL_CATEGORY_MAP[detail]) return DETAIL_CATEGORY_MAP[detail]
  if (/GROCER|SUPERMARKET/.test(detail)) return "Groceries"
  if (/BOOKSTORE|EDUCATION|TUITION|SCHOOL|COLLEGE|UNIVERSITY/.test(detail)) return "School"
  if (detail.startsWith("FOOD_AND_DRINK_")) return "Food"
  if (detail.startsWith("TRANSPORTATION_") || detail.startsWith("TRAVEL_")) return "Transport"
  if (detail.startsWith("ENTERTAINMENT_")) return "Entertainment"
  if (detail.startsWith("GENERAL_MERCHANDISE_") || detail.startsWith("HOME_IMPROVEMENT_")) return "Shopping"
  return null
}

export function categorizeTransactionDecision(transaction) {
  const searchable = [transaction.merchant_name, transaction.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  const override = configuredOverrides().find((rule) => searchable.includes(rule.match))
  if (override) return { category: override.category, needsReview: false, source: "override" }

  const merchantRule = MERCHANT_CATEGORY_RULES.find((rule) => rule.pattern.test(searchable))
  if (merchantRule) return { category: merchantRule.category, needsReview: false, source: "merchant" }

  const detail = transaction.personal_finance_category?.detailed
  const detailCategory = categoryFromDetail(detail)
  const confidence = transaction.personal_finance_category?.confidence_level
  const lowConfidence = confidence === "LOW" || confidence === "UNKNOWN"
  if (detailCategory) {
    return { category: detailCategory, needsReview: lowConfidence, source: "plaid_detail" }
  }

  const primary = transaction.personal_finance_category?.primary
  const primaryCategory = PRIMARY_CATEGORY_MAP[primary]
  if (primaryCategory) {
    return {
      category: primaryCategory,
      needsReview: lowConfidence || !detail,
      source: "plaid_primary",
    }
  }

  return { category: "Other", needsReview: true, source: "unknown" }
}

export function categorizeTransaction(transaction) {
  return categorizeTransactionDecision(transaction).category
}

export function categoryNames() {
  return [...VALID_CATEGORIES]
}
