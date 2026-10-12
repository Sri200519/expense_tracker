"use client"

import Script from "next/script"
import { useMemo, useState } from "react"
import { Check, Copy, Loader2, LockKeyhole } from "lucide-react"

type PlaidHandler = { open: () => void; destroy: () => void }
type ConnectedItem = {
  label: string
  accessToken: string
  itemId: string
  accounts: Array<{ name: string; officialName?: string; mask?: string; type: string; subtype?: string }>
}

declare global {
  interface Window {
    Plaid?: {
      create: (config: {
        token: string
        onSuccess: (publicToken: string) => void
        onExit: (error?: unknown) => void
      }) => PlaidHandler
    }
  }
}

const CONNECTIONS = [
  { label: "Capital One", secret: "PLAID_ACCESS_TOKEN_CAPITAL_ONE" },
  { label: "American Express", secret: "PLAID_ACCESS_TOKEN_AMEX" },
  { label: "Venmo", secret: "PLAID_ACCESS_TOKEN_VENMO" },
]

export default function PlaidSetupPage() {
  const [passphrase, setPassphrase] = useState("")
  const [items, setItems] = useState<ConnectedItem[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState<string | null>(null)

  const itemsByLabel = useMemo(() => new Map(items.map((item) => [item.label, item])), [items])

  const connect = async (label: string) => {
    if (!passphrase) {
      setError("Enter the app passphrase first.")
      return
    }
    if (!window.Plaid) {
      setError("Plaid Link is still loading. Try again in a moment.")
      return
    }

    setBusy(label)
    setError("")
    try {
      const tokenResponse = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "x-setup-passphrase": passphrase },
      })
      const tokenData = await tokenResponse.json()
      if (!tokenResponse.ok) throw new Error(tokenData.error || "Could not start Plaid Link")

      let handler: PlaidHandler
      handler = window.Plaid.create({
        token: tokenData.linkToken,
        onSuccess: async (publicToken) => {
          try {
            const exchangeResponse = await fetch("/api/plaid/exchange", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-setup-passphrase": passphrase,
              },
              body: JSON.stringify({ publicToken, label }),
            })
            const exchangeData = await exchangeResponse.json()
            if (!exchangeResponse.ok) throw new Error(exchangeData.error || "Could not save the connection")
            setItems((current) => [...current.filter((item) => item.label !== label), exchangeData])
          } catch (exchangeError) {
            setError(exchangeError instanceof Error ? exchangeError.message : "Could not exchange the Plaid token")
          } finally {
            handler.destroy()
            setBusy(null)
          }
        },
        onExit: () => {
          handler.destroy()
          setBusy(null)
        },
      })
      handler.open()
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Could not connect the account")
      setBusy(null)
    }
  }

  const copyToken = async (secret: string, token: string) => {
    await navigator.clipboard.writeText(token)
    setCopied(secret)
    window.setTimeout(() => setCopied(null), 1500)
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-5 py-10">
      <Script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" strategy="afterInteractive" />
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">One-time setup</p>
          <h1 className="mt-2 text-3xl font-semibold">Connect accounts to GitHub Actions</h1>
          <p className="mt-3 text-muted-foreground">
            Connect each institution once, then copy its access token into the matching GitHub Actions secret. The daily job runs in GitHub; this page does not need to stay open.
          </p>
        </div>

        <label className="block rounded-2xl border border-border bg-card p-5">
          <span className="mb-2 flex items-center gap-2 text-sm font-medium">
            <LockKeyhole className="h-4 w-4" /> App passphrase
          </span>
          <input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Same passphrase used for Expense Tracker"
            className="w-full rounded-xl bg-secondary px-4 py-3 outline-none ring-primary focus:ring-2"
          />
        </label>

        <div className="space-y-3">
          {CONNECTIONS.map(({ label, secret }) => {
            const item = itemsByLabel.get(label)
            return (
              <section key={label} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">{label}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">GitHub secret: {secret}</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy !== null || Boolean(item)}
                    onClick={() => connect(label)}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {busy === label ? <Loader2 className="h-4 w-4 animate-spin" /> : item ? "Connected" : "Connect"}
                  </button>
                </div>

                {item && (
                  <div className="mt-4 space-y-3 rounded-xl bg-secondary p-4">
                    <div className="flex items-center gap-2 text-sm text-green-500">
                      <Check className="h-4 w-4" /> Connected {item.accounts.map((account) => `${account.name}${account.mask ? ` ••••${account.mask}` : ""}`).join(", ")}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToken(secret, item.accessToken)}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    >
                      {copied === secret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied === secret ? "Copied" : "Copy access token"}
                    </button>
                  </div>
                )}
              </section>
            )
          })}
        </div>

        {error && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}

        <p className="text-sm text-muted-foreground">
          Treat access tokens like passwords. Put them only in GitHub Actions secrets, never in the repository or a screenshot.
        </p>
      </div>
    </main>
  )
}
