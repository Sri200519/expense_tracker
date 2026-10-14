"use client"

import { useState } from "react"
import {
  Banknote,
  Book,
  Car,
  Coffee,
  CreditCard,
  Home,
  MoreHorizontal,
  Package,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tv,
  Utensils,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Expense {
  id: string
  amount: number
  category: string
  merchant: string
  date: Date
  paymentMethod?: string
}

const categoryConfig: Record<string, { icon: typeof Utensils; color: string; barColor: string }> = {
  Food: { icon: Utensils, color: "bg-orange-500/20 text-orange-400", barColor: "bg-orange-400" },
  Coffee: { icon: Coffee, color: "bg-amber-500/20 text-amber-400", barColor: "bg-amber-400" },
  Shopping: { icon: ShoppingBag, color: "bg-pink-500/20 text-pink-400", barColor: "bg-pink-400" },
  Transport: { icon: Car, color: "bg-blue-500/20 text-blue-400", barColor: "bg-blue-400" },
  Home: { icon: Home, color: "bg-emerald-500/20 text-emerald-400", barColor: "bg-emerald-400" },
  Utilities: { icon: Zap, color: "bg-yellow-500/20 text-yellow-400", barColor: "bg-yellow-400" },
  Bills: { icon: Zap, color: "bg-red-500/20 text-red-400", barColor: "bg-red-400" },
  School: { icon: Book, color: "bg-sky-500/20 text-sky-400", barColor: "bg-sky-400" },
  Entertainment: { icon: Tv, color: "bg-purple-500/20 text-purple-400", barColor: "bg-purple-400" },
  Paraphernalia: { icon: Package, color: "bg-slate-500/20 text-slate-400", barColor: "bg-slate-400" },
  Groceries: { icon: ShoppingCart, color: "bg-green-500/20 text-green-400", barColor: "bg-green-400" },
  Other: { icon: MoreHorizontal, color: "bg-gray-500/20 text-gray-400", barColor: "bg-gray-400" },
}

const paymentIcons: Record<string, typeof CreditCard> = {
  Card: CreditCard,
  "Capital One": CreditCard,
  "American Express": CreditCard,
  Cash: Banknote,
  Venmo: Smartphone,
}

interface SpendingDashboardProps {
  expenses: Expense[]
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

export function SpendingDashboard({ expenses }: SpendingDashboardProps) {
  const [visibleTransactionCount, setVisibleTransactionCount] = useState(20)
  const now = new Date()
  const validExpenses = expenses.filter((expense) => Number.isFinite(expense.amount) && expense.amount !== 0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const monthlyExpenses = validExpenses.filter((expense) => expense.date >= monthStart && expense.date <= now)
  const previousMonthExpenses = validExpenses.filter(
    (expense) => expense.date >= previousMonthStart && expense.date < monthStart
  )
  const purchases = monthlyExpenses.filter((expense) => expense.amount > 0)
  const refunds = monthlyExpenses.filter((expense) => expense.amount < 0)
  const purchaseTotal = purchases.reduce((sum, expense) => sum + expense.amount, 0)
  const refundTotal = Math.abs(refunds.reduce((sum, expense) => sum + expense.amount, 0))
  const monthlyTotal = purchaseTotal - refundTotal
  const previousMonthTotal = previousMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  const monthChange = previousMonthTotal === 0
    ? null
    : ((monthlyTotal - previousMonthTotal) / Math.abs(previousMonthTotal)) * 100
  const averagePurchase = purchases.length ? purchaseTotal / purchases.length : 0

  const monthlyData = Array.from({ length: 6 }, (_, index) => {
    const monthsAgo = 5 - index
    const periodStart = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1)
    const total = validExpenses
      .filter((expense) => expense.date >= periodStart && expense.date < periodEnd)
      .reduce((sum, expense) => sum + expense.amount, 0)

    return {
      label: periodStart.toLocaleDateString("en-US", { month: "short" }),
      total,
    }
  })
  const maxMonthlySpend = Math.max(...monthlyData.map((month) => Math.max(Math.abs(month.total), 0)), 1)

  const categoryTotals = monthlyExpenses.reduce((totals, expense) => {
    const current = totals[expense.category] || { net: 0, purchases: 0, refunds: 0, count: 0 }
    current.net += expense.amount
    current.count += 1
    if (expense.amount > 0) current.purchases += expense.amount
    if (expense.amount < 0) current.refunds += Math.abs(expense.amount)
    totals[expense.category] = current
    return totals
  }, {} as Record<string, { net: number; purchases: number; refunds: number; count: number }>)
  const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b.net - a.net)
  const maxCategorySpend = Math.max(...sortedCategories.map(([, totals]) => Math.max(totals.net, 0)), 1)

  const paymentTotals = monthlyExpenses.reduce((totals, expense) => {
    const method = expense.paymentMethod || "Card"
    const current = totals[method] || { total: 0, count: 0 }
    current.total += expense.amount
    current.count += 1
    totals[method] = current
    return totals
  }, {} as Record<string, { total: number; count: number }>)
  const sortedPaymentMethods = Object.entries(paymentTotals).sort(([, a], [, b]) => b.total - a.total)

  const recentTransactions = validExpenses.slice(0, visibleTransactionCount)

  const formatDate = (date: Date) => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const transactionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffDays = Math.round((today.getTime() - transactionDay.getTime()) / 86_400_000)
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
    })
  }

  const getCategoryInfo = (categoryName: string) => categoryConfig[categoryName] || categoryConfig.Other

  return (
    <div className="min-h-screen bg-background px-4 pb-8 pt-12 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Monthly, category, and card breakdowns</p>
      </header>

      <div className="bg-card rounded-2xl p-5 mb-4 border border-border">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
          {now.toLocaleDateString("en-US", { month: "long" })} net spending
        </p>
        <span className="text-4xl font-bold text-foreground">{currency.format(monthlyTotal)}</span>
        <div className="mt-2 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{monthlyExpenses.length} transactions</span>
          {monthChange !== null && (
            <span className={cn("text-right", monthChange <= 0 ? "text-green-500" : "text-orange-400")}>
              {Math.abs(monthChange).toFixed(0)}% {monthChange <= 0 ? "lower" : "higher"} than last month
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-card rounded-xl p-3 border border-border">
          <ReceiptText className="w-4 h-4 text-primary mb-2" />
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Purchases</p>
          <p className="text-sm font-semibold text-foreground mt-1">{currency.format(purchaseTotal)}</p>
          <p className="text-[10px] text-muted-foreground">{purchases.length} charges</p>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border">
          <RotateCcw className="w-4 h-4 text-green-500 mb-2" />
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Refunds</p>
          <p className="text-sm font-semibold text-green-500 mt-1">{currency.format(refundTotal)}</p>
          <p className="text-[10px] text-muted-foreground">{refunds.length} refunds</p>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border">
          <MoreHorizontal className="w-4 h-4 text-muted-foreground mb-2" />
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Average</p>
          <p className="text-sm font-semibold text-foreground mt-1">{currency.format(averagePurchase)}</p>
          <p className="text-[10px] text-muted-foreground">per charge</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl p-5 mb-5 border border-border">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Monthly net spend</h2>
        <div className="space-y-3">
          {monthlyData.map((month) => (
            <div key={month.label} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">{month.label}</span>
              <div className="flex-1 h-6 bg-secondary rounded-lg overflow-hidden">
                <div
                  className={cn("h-full rounded-lg transition-all duration-500", month.total < 0 ? "bg-green-500" : "bg-primary")}
                  style={{ width: `${(Math.abs(month.total) / maxMonthlySpend) * 100}%` }}
                />
              </div>
              <span className={cn("text-sm font-medium w-20 text-right", month.total < 0 ? "text-green-500" : "text-foreground")}>
                {currency.format(month.total)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-2xl p-5 mb-5 border border-border">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-4">By category</h2>
        {sortedCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No expenses this month</p>
        ) : (
          <div className="space-y-4">
            {sortedCategories.map(([category, totals]) => {
              const catInfo = getCategoryInfo(category)
              const Icon = catInfo.icon
              const percentage = purchaseTotal > 0 ? (totals.purchases / purchaseTotal) * 100 : 0

              return (
                <div key={category}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", catInfo.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{category}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {totals.count} transactions · {percentage.toFixed(0)}% of purchases
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={cn("text-sm font-semibold", totals.net < 0 ? "text-green-500" : "text-foreground")}>
                        {currency.format(totals.net)}
                      </p>
                      {totals.refunds > 0 && <p className="text-[10px] text-green-500">{currency.format(totals.refunds)} refunded</p>}
                    </div>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", catInfo.barColor)}
                      style={{ width: `${Math.max(0, totals.net / maxCategorySpend) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl p-5 mb-5 border border-border">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-4">By payment method</h2>
        {sortedPaymentMethods.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No expenses this month</p>
        ) : (
          <div className="space-y-3">
            {sortedPaymentMethods.map(([method, totals]) => {
              const Icon = paymentIcons[method] || CreditCard
              return (
                <div key={method} className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
                  <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{method}</p>
                    <p className="text-xs text-muted-foreground">{totals.count} transactions</p>
                  </div>
                  <p className={cn("text-sm font-semibold", totals.total < 0 ? "text-green-500" : "text-foreground")}>
                    {currency.format(totals.total)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl p-5 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs uppercase tracking-wide text-muted-foreground">All transactions</h2>
          <span className="text-xs text-muted-foreground">{validExpenses.length} total</span>
        </div>
        {recentTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((expense) => {
              const catInfo = getCategoryInfo(expense.category)
              const Icon = catInfo.icon

              return (
                <div key={expense.id} className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", catInfo.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{expense.merchant}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {expense.category} · {expense.paymentMethod || "Card"} · {formatDate(expense.date)}
                    </p>
                  </div>
                  <span className={cn("text-sm font-semibold", expense.amount < 0 ? "text-green-500" : "text-foreground")}>
                    {expense.amount < 0 ? "+" : "-"}${Math.abs(expense.amount).toFixed(2)}
                  </span>
                </div>
              )
            })}
            {visibleTransactionCount < validExpenses.length && (
              <button
                onClick={() => setVisibleTransactionCount((count) => count + 20)}
                className="w-full rounded-xl bg-secondary py-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                Show 20 more ({validExpenses.length - visibleTransactionCount} remaining)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
