# Expense Tracker

This app stores expenses in Notion. Its automation can pull Capital One and American Express card transactions from Plaid, categorize them, send each new transaction to a free Telegram bot for review, and apply the amount you reply with as your personal share.

The recurring jobs run in GitHub Actions. Your computer does not need to stay on.

## What the automation does

- Pulls a rolling 45-day window once per day, but never imports anything before the configured `PLAID_IMPORT_START_DATE`.
- Uses Plaid's stable transaction ID to upsert rows, so reruns do not create duplicates.
- Replaces matched pending transactions with their posted versions and sends an **Expense posted** Telegram notice.
- Excludes card payments and ordinary transfers to prevent double-counting.
- Includes merchant refunds as negative amounts. For Venmo, it includes outgoing personal payments and refunds while excluding incoming payments and transfers.
- Deduplicates a matching `VENMO` charge on Capital One or American Express when the same payment is present in the connected Venmo feed.
- Keeps `Statement Amount` unchanged and uses `Total Amount` for your share.
- Maps Plaid personal-finance categories into the app's existing categories.
- Sends each new transaction to Telegram. Reply directly with `12.50`, `$12.50`, or `0`.
- Shows the suggested Notion category. Correct it with a reply such as `12.50 | Groceries`.
- Requires an amount-and-category reply when Plaid's category is missing or low-confidence.
- Processes Telegram replies hourly in GitHub Actions and updates the matching Notion row.

## One-time setup

### 1. Activate Plaid's free trial

In the Plaid Dashboard, complete the free-trial project form. The current Trial plan uses the Production environment for real account data and allows up to 10 connected Items at no cost. Sandbox credentials only return test data.

### 2. Add Plaid credentials to the deployed app

Add these environment variables to the existing app deployment:

- `PLAID_ENV=production`
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`

Redeploy, sign in, and open `/plaid-setup`. Connect Capital One, American Express, and Venmo. Plaid's institution directory currently lists Venmo Personal with Transactions support. Copy each access token into the matching GitHub Actions secret listed on the page.

If Venmo is not offered by Plaid, transactions funded by a connected card or bank account will still commonly appear on that funding account as Venmo charges. Venmo-balance-only activity will require a separate source later; the workflow deliberately does not scrape private Venmo pages.

### 3. Create a free Telegram bot

1. In Telegram, message `@BotFather`, run `/newbot`, and save the bot token.
2. Open the new bot and send `/start`. A bot cannot message you until you contact it once.
3. Open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` and copy the numeric `message.chat.id` value from your `/start` message.

### 4. Add GitHub Actions secrets

In the repository, open **Settings → Secrets and variables → Actions** and create:

- `NOTION_API_KEY`
- `NOTION_DATABASE_ID`
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ACCESS_TOKEN_CAPITAL_ONE`
- `PLAID_ACCESS_TOKEN_AMEX`
- `PLAID_ACCESS_TOKEN_VENMO` (only if Plaid supports the connection)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Optional: add `CATEGORY_OVERRIDES_JSON` for merchant-specific corrections. Example:

```json
[{"match":"campus store","category":"School"}]
```

The checked-in workflow sets `PLAID_IMPORT_START_DATE` to `2026-10-12`, so the first run cannot import older transactions. Change that date before the first run only if you intentionally want a different starting day.

### 5. Run once and verify

Open **Actions → Daily expense sync → Run workflow**. The first run imports only transactions on or after October 12, 2026 and sends Telegram review prompts. After you reply, **Process transaction review replies** applies the amount on its next hourly run; it can also be run manually. For a category correction, use `amount | category`, such as `5 | Groceries`. Valid categories are Food, Shopping, School, Transport, Entertainment, Paraphernalia, Groceries, and Other.

The daily schedule is 7:17 AM America/New_York. GitHub may delay scheduled jobs during periods of high load.

## Local verification (optional)

```bash
pnpm test:automation
pnpm build
```

Local execution is optional. The production schedules live in `.github/workflows/`.
