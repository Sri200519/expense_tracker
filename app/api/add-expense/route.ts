import { NextResponse } from "next/server"
import { Client } from "@notionhq/client"
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate required fields
    const { date, merchant, amount, category, paymentMethod, notes, receiptImageUrl } = body

    if (!date || !merchant || amount === undefined || !category) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Initialize Notion client
    if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
      console.error("Missing Notion environment variables")
      return NextResponse.json(
        { success: false, error: "Notion integration is not configured" },
        { status: 500 }
      )
    }

    const notion = new Client({ auth: process.env.NOTION_API_KEY })
    
    // Map properties according to the schema
    const properties: any = {
      "Date": { date: { start: date } },
      "Merchant": { title: [{ text: { content: merchant } }] },
      "Total Amount": { number: amount },
      "Category": { select: { name: category } },
      "Payment Method": { select: { name: paymentMethod || "Card" } },
    }

    if (notes) {
      properties["Notes"] = { rich_text: [{ text: { content: notes } }] }
    }

    // Add Auto-Detected flag if it's from OCR
    // We can assume it's from OCR if receiptImageUrl is provided, but the frontend could pass a specific flag.
    // For now, if there's a receipt, we mark it.
    if (receiptImageUrl) {
      properties["Auto-Detected"] = { checkbox: true }
    }

    const response = await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: properties,
    })

    // Return success response with the Notion page ID
    return NextResponse.json({
      success: true,
      id: response.id,
    })
  } catch (error) {
    console.error("Error adding expense:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
