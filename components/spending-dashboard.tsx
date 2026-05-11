"use client"

import { Utensils, Car, ShoppingBag, Zap, MoreHorizontal, Coffee, Home } from "lucide-react"
import { cn } from "@/lib/utils"

interface Expense {
  id: string
  amount: number
  category: string
  merchant: string
  date: Date
}

const categoryConfig: Record<string, { icon: typeof Utensils; color: string; barColor: string }> = {
  Food: { icon: Utensils, color: "bg-orange-500/20 text-orange-400", barColor: "bg-orange-400" },
  Coffee: { icon: Coffee, color: "bg-amber-500/20 text-amber-400", barColor: "bg-amber-400" },
  Shopping: { icon: ShoppingBag, color: "bg-pink-500/20 text-pink-400", barColor: "bg-pink-400" },
  Transport: { icon: Car, color: "bg-blue-500/20 text-blue-400", barColor: "bg-blue-400" },
  Home: { icon: Home, color: "bg-green-500/20 text-green-400", barColor: "bg-green-400" },
  Utilities: { icon: Zap, color: "bg-yellow-500/20 text-yellow-400", barColor: "bg-yellow-400" },
  Other: { icon: MoreHorizontal, color: "bg-gray-500/20 text-gray-400", barColor: "bg-gray-400" },
}

interface SpendingDashboardProps {
  expenses: Expense[]
}

export function SpendingDashboard({ expenses }: SpendingDashboardProps) {
  const now = new Date()
  
  // Monthly total
  const monthlyExpenses = expenses.filter(e => 
    e.date.getMonth() === now.getMonth() && e.date.getFullYear() === now.getFullYear()
  )
  const monthlyTotal = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0)
  
  // Weekly breakdown (last 4 weeks)
  const weeklyData = Array.from({ length: 4 }, (_, i) => {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - (i * 7) - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)
    
    const weekExpenses = expenses.filter(e => e.date >= weekStart && e.date < weekEnd)
    const total = weekExpenses.reduce((sum, e) => sum + e.amount, 0)
    
    return {
      label: i === 0 ? "This Week" : i === 1 ? "Last Week" : `${i} weeks ago`,
      total,
    }
  }).reverse()
  
  const maxWeeklySpend = Math.max(...weeklyData.map(w => w.total), 1)
  
  // Category breakdown
  const categoryTotals = monthlyExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount
    return acc
  }, {} as Record<string, number>)
  
  const sortedCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
  
  const maxCategorySpend = Math.max(...sortedCategories.map(([, total]) => total), 1)
  
  // Recent 10 transactions
  const recentTransactions = expenses.slice(0, 10)
  
  const formatDate = (date: Date) => {
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }
  
  const getCategoryInfo = (categoryName: string) => {
    return categoryConfig[categoryName] || categoryConfig.Other
  }

  return (
    <div className="min-h-screen bg-background px-4 pb-8 pt-12 max-w-md mx-auto">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Your spending overview</p>
      </header>

      {/* Monthly Total Card */}
      <div className="bg-card rounded-2xl p-5 mb-5 border border-border">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
          {now.toLocaleDateString("en-US", { month: "long" })} Total
        </p>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-foreground">${monthlyTotal.toFixed(2)}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {monthlyExpenses.length} transactions
        </p>
      </div>

      {/* Weekly Breakdown */}
      <div className="bg-card rounded-2xl p-5 mb-5 border border-border">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Weekly Spend</h2>
        <div className="space-y-3">
          {weeklyData.map((week, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">{week.label}</span>
              <div className="flex-1 h-6 bg-secondary rounded-lg overflow-hidden">
                <div
                  className="h-full bg-primary rounded-lg transition-all duration-500"
                  style={{ width: `${(week.total / maxWeeklySpend) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium text-foreground w-16 text-right">
                ${week.total.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-card rounded-2xl p-5 mb-5 border border-border">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-4">By Category</h2>
        {sortedCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No expenses this month</p>
        ) : (
          <div className="space-y-4">
            {sortedCategories.map(([category, total]) => {
              const catInfo = getCategoryInfo(category)
              const Icon = catInfo.icon
              const percentage = ((total / monthlyTotal) * 100).toFixed(0)
              
              return (
                <div key={category}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", catInfo.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{percentage}%</span>
                      <span className="text-sm font-semibold text-foreground">${total.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", catInfo.barColor)}
                      style={{ width: `${(total / maxCategorySpend) * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Recent Transactions</h2>
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
                    <p className="text-xs text-muted-foreground">{formatDate(expense.date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    -${expense.amount.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
