import { NextResponse } from "next/server"
import { createPlaidLinkToken, validateSetupPassphrase } from "@/lib/plaid-server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    if (!validateSetupPassphrase(request.headers.get("x-setup-passphrase"))) {
      return NextResponse.json({ success: false, error: "Invalid setup passphrase" }, { status: 401 })
    }
    const data = await createPlaidLinkToken()
    return NextResponse.json({ success: true, linkToken: data.link_token })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create a Plaid Link token"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
