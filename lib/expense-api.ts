export interface ExpensePayload {
  date: string
  merchant: string
  amount: number
  category: string
  paymentMethod: string
  notes: string
  receiptImageUrl: string | null
}

export interface ExpenseResponse {
  success: boolean
  id?: string
  error?: string
}

export async function addExpense(payload: ExpensePayload): Promise<ExpenseResponse> {
  const response = await fetch("/api/add-expense", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to add expense" }))
    return { success: false, error: error.error || "Failed to add expense" }
  }

  return response.json()
}
