import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

const NOTION_QUERY_PAGE_SIZE = 100

export async function GET() {
  try {
    if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
      console.error("Missing Notion environment variables")
      return NextResponse.json(
        { success: false, error: "Notion integration is not configured" },
        { status: 500 }
      )
    }

    const results: any[] = []
    let startCursor: string | undefined

    do {
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
          filter: {
            and: [
              {
                property: "Excluded",
                checkbox: { equals: false }
              },
              {
                property: "Total Amount",
                number: { is_not_empty: true }
              },
              {
                property: "Total Amount",
                number: { does_not_equal: 0 }
              }
            ]
          },
          page_size: NOTION_QUERY_PAGE_SIZE,
          ...(startCursor ? { start_cursor: startCursor } : {})
        })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error("Notion API Error:", data)
        throw new Error(data.message || "Failed to query Notion")
      }

      results.push(...data.results)
      startCursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
    } while (startCursor)

    const expenses = results.map((page: any) => {
      const properties = page.properties
      
      // Extract properties safely
      const dateStr = properties["Date"]?.date?.start || new Date().toISOString()
      const merchant = properties["Merchant"]?.title?.[0]?.plain_text || "Unknown"
      const amount = properties["Total Amount"]?.number
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
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    })
  } catch (error) {
    console.error("Error fetching expenses:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
