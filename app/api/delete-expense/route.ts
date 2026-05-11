import { NextResponse } from "next/server"

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing expense ID" },
        { status: 400 }
      )
    }

    if (!process.env.NOTION_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Notion integration is not configured" },
        { status: 500 }
      )
    }

    const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        archived: true
      })
    })

    if (!response.ok) {
      const data = await response.json()
      console.error("Notion API Error:", data)
      throw new Error(data.message || "Failed to delete expense from Notion")
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting expense:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
