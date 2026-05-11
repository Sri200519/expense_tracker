import { NextResponse } from "next/server"
import { Client } from "@notionhq/client"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
      console.error("Missing Notion environment variables")
      return NextResponse.json(
        { success: false, error: "Notion integration is not configured" },
        { status: 500 }
      )
    }

    const response = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sorts: [
          {
            property: "Date",
            direction: "descending"
          }
        ],
        page_size: 50
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Notion API Error:", data)
      throw new Error(data.message || "Failed to query Notion")
    }

    const expenses = data.results.map((page: any) => {
      const properties = page.properties
      
      // Extract properties safely
      const dateStr = properties["Date"]?.date?.start || new Date().toISOString()
      const merchant = properties["Merchant"]?.title?.[0]?.plain_text || "Unknown"
      const amount = properties["Total Amount"]?.number || 0
      const category = properties["Category"]?.select?.name || "Other"
      const paymentMethod = properties["Payment Method"]?.select?.name || "Card"

      return {
        id: page.id,
        date: new Date(dateStr),
        merchant,
        amount,
        category,
        paymentMethod,
      }
    })

    return NextResponse.json({
      success: true,
      expenses,
    })
  } catch (error) {
    console.error("Error fetching expenses:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
