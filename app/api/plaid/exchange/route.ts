import { NextResponse } from "next/server"
import {
  exchangePlaidPublicToken,
  getPlaidAccounts,
  validateSetupPassphrase,
} from "@/lib/plaid-server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    if (!validateSetupPassphrase(request.headers.get("x-setup-passphrase"))) {
      return NextResponse.json({ success: false, error: "Invalid setup passphrase" }, { status: 401 })
    }

    const { publicToken, label } = await request.json()
    if (typeof publicToken !== "string" || !publicToken) {
      return NextResponse.json({ success: false, error: "Missing public token" }, { status: 400 })
    }

    const exchange = await exchangePlaidPublicToken(publicToken)
    const accountData = await getPlaidAccounts(exchange.access_token)
    const accounts = (accountData.accounts || []).map((account: any) => ({
      name: account.name,
      officialName: account.official_name,
      mask: account.mask,
      type: account.type,
      subtype: account.subtype,
    }))

    return NextResponse.json({
      success: true,
      label,
      itemId: exchange.item_id,
      accessToken: exchange.access_token,
      accounts,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to exchange the Plaid token"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
