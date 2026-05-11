"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Plus, Coffee, ShoppingBag, Car, Utensils, Home, Zap, MoreHorizontal, Trash2, Camera, X, Loader2, Check, Calendar, BarChart3, Receipt, Book, Tv, Package, ShoppingCart } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SpendingDashboard } from "./spending-dashboard"
import { useToast } from "@/hooks/use-toast"
import { addExpense, type ExpensePayload } from "@/lib/expense-api"

interface Expense {
  id: string
  amount: number
  category: string
  merchant: string
  date: Date
  paymentMethod?: string
  notes?: string
  receiptImageUrl?: string | null
}

interface ScannedData {
  merchant: string
  amount: string
  date: Date | null
}

const categories = [
  { name: "Food", icon: Utensils, color: "bg-orange-500/20 text-orange-400" },
  { name: "Shopping", icon: ShoppingBag, color: "bg-pink-500/20 text-pink-400" },
  { name: "School", icon: Book, color: "bg-blue-500/20 text-blue-400" },
  { name: "Transport", icon: Car, color: "bg-yellow-500/20 text-yellow-400" },
  { name: "Entertainment", icon: Tv, color: "bg-purple-500/20 text-purple-400" },
  { name: "Paraphernalia", icon: Package, color: "bg-gray-500/20 text-gray-400" },
  { name: "Groceries", icon: ShoppingCart, color: "bg-green-500/20 text-green-400" },
  { name: "Other", icon: MoreHorizontal, color: "bg-gray-500/20 text-gray-400" },
]

const initialExpenses: Expense[] = []

function compressImage(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const img = new Image();
      img.src = result;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch (e) {
          console.warn("Canvas compression failed, using original image", e);
          resolve(result);
        }
      };
      img.onerror = (error) => {
        console.warn("Image load failed for compression, using original image", error);
        resolve(result);
      };
    };
    reader.onerror = (error) => {
      reject(new Error("Failed to read file: " + error));
    };
  });
}

async function extractReceiptData(image: string | File | Blob): Promise<ScannedData> {
  try {
    let imageBlob: Blob;

    if (typeof image === 'string') {
      const response = await fetch(image);
      imageBlob = await response.blob();
    } else {
      imageBlob = image;
    }

    // Convert HEIC to JPEG if needed
    if (imageBlob.type === 'image/heic' || imageBlob.type === 'image/heif' || 
       (image instanceof File && (image.name.toLowerCase().endsWith('.heic') || image.name.toLowerCase().endsWith('.heif')))) {
      try {
        const heic2any = (await import('heic2any')).default;
        const converted = await heic2any({
          blob: imageBlob,
          toType: 'image/jpeg',
          quality: 0.8
        });
        imageBlob = Array.isArray(converted) ? converted[0] : converted;
      } catch (e) {
        console.warn('Failed to convert HEIC to JPEG', e);
      }
    }

    const base64Image = await compressImage(imageBlob);

    const res = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Image })
    });

    if (!res.ok) {
      let errText = res.statusText;
      try {
        const errorData = await res.json();
        errText = errorData.error || errText;
      } catch (e) {
        // ignore json parse error
      }
      throw new Error(`OCR API failed: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    return {
      merchant: data.merchant,
      amount: data.amount,
      date: data.date ? new Date(data.date) : new Date()
    };
  } catch (error) {
    console.error("OCR Error:", error);
    return { merchant: "Scan Failed", amount: "", date: new Date() };
  }
}

export function ExpenseTracker() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"expenses" | "analytics">("expenses")
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true)
  
  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        const res = await fetch("/api/expenses")
        const data = await res.json()
        if (data.success && data.expenses) {
          const formatted = data.expenses.map((e: any) => ({
            ...e,
            date: new Date(e.date)
          }))
          setExpenses(formatted)
        }
      } catch (error) {
        console.error("Failed to fetch expenses:", error)
      } finally {
        setIsLoadingExpenses(false)
      }
    }
    fetchExpenses()
  }, [])

  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [merchant, setMerchant] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("Card")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [receiptImage, setReceiptImage] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
  const [confirmAmount, setConfirmAmount] = useState("")
  const [confirmMerchant, setConfirmMerchant] = useState("")
  const [confirmCategory, setConfirmCategory] = useState<string | null>(null)
  const [confirmDate, setConfirmDate] = useState<Date | null>(null)
  const [confirmPaymentMethod, setConfirmPaymentMethod] = useState("Card")
  const [confirmNotes, setConfirmNotes] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Quick Add state
  const [quickAmount, setQuickAmount] = useState("")
  const [quickMerchant, setQuickMerchant] = useState("")
  const [quickCategory, setQuickCategory] = useState<string>("Food")
  const [quickPaymentMethod, setQuickPaymentMethod] = useState("Card")
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false)
  const [quickSuccess, setQuickSuccess] = useState(false)
  const quickInputRef = useRef<HTMLInputElement>(null)

  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const monthlyTotal = expenses
    .filter(e => {
      const now = new Date()
      return e.date.getMonth() === now.getMonth() && e.date.getFullYear() === now.getFullYear()
    })
    .reduce((sum, e) => sum + e.amount, 0)

  // Quick Add handler - ultra-fast expense entry
  const handleQuickAdd = useCallback(async () => {
    if (!quickAmount || isQuickSubmitting) return

    const parsedAmount = parseFloat(quickAmount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) return

    setIsQuickSubmitting(true)

    const expenseDate = new Date()
    const payload: ExpensePayload = {
      date: expenseDate.toISOString(),
      merchant: quickMerchant || "Quick Entry",
      amount: parsedAmount,
      category: quickCategory,
      paymentMethod: quickPaymentMethod,
      notes: "",
      receiptImageUrl: null,
    }

    const result = await addExpense(payload)

    setIsQuickSubmitting(false)

    if (result.success) {
      const newExpense: Expense = {
        id: result.id || Date.now().toString(),
        amount: parsedAmount,
        category: quickCategory,
        merchant: quickMerchant || "Quick Entry",
        date: expenseDate,
        paymentMethod: quickPaymentMethod,
      }

      setExpenses(prev => [newExpense, ...prev])
      setQuickAmount("")
      setQuickMerchant("")
      setQuickSuccess(true)

      // Brief success flash, then reset
      setTimeout(() => setQuickSuccess(false), 1000)

      // Refocus input for next entry
      quickInputRef.current?.focus()
    } else {
      toast({
        title: "Failed to save",
        description: result.error || "Please try again.",
        variant: "destructive",
      })
    }
  }, [quickAmount, quickCategory, isQuickSubmitting, toast])

  const handleAddExpense = useCallback(async () => {
    if (!amount || !selectedCategory) return

    setIsSubmitting(true)

    const expenseDate = new Date()
    const payload: ExpensePayload = {
      date: expenseDate.toISOString(),
      merchant: merchant || "Unknown",
      amount: parseFloat(amount),
      category: selectedCategory,
      paymentMethod: paymentMethod,
      notes: notes,
      receiptImageUrl: null,
    }

    const result = await addExpense(payload)

    setIsSubmitting(false)

    if (result.success) {
      const newExpense: Expense = {
        id: result.id || Date.now().toString(),
        amount: parseFloat(amount),
        category: selectedCategory,
        merchant: merchant || "Unknown",
        date: expenseDate,
        paymentMethod: paymentMethod,
        notes: notes,
        receiptImageUrl: null,
      }

      setExpenses(prev => [newExpense, ...prev])
      setAmount("")
      setSelectedCategory(null)
      setMerchant("")
      setPaymentMethod("Card")
      setNotes("")
      setShowForm(false)

      toast({
        title: "Expense added",
        description: `$${parseFloat(amount).toFixed(2)} at ${merchant || "Unknown"} saved successfully.`,
      })
    } else {
      toast({
        title: "Failed to add expense",
        description: result.error || "Please try again.",
        variant: "destructive",
      })
    }
  }, [amount, selectedCategory, merchant, paymentMethod, notes, toast])

  const handleDeleteExpense = useCallback((id: string) => {
    setExpenseToDelete(id)
  }, [])

  const confirmDelete = async () => {
    if (!expenseToDelete) return
    
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/delete-expense?id=${expenseToDelete}`, { method: "DELETE" })
      const data = await res.json()
      
      if (data.success) {
        setExpenses(prev => prev.filter(e => e.id !== expenseToDelete))
        toast({
          title: "Expense deleted",
          description: "The expense has been removed.",
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({
        title: "Failed to delete",
        description: error.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setExpenseToDelete(null)
    }
  }

  const handleReceiptUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const imageUrl = URL.createObjectURL(file)
    setReceiptImage(imageUrl)
    setIsScanning(true)

    try {
      const data = await extractReceiptData(file)
      setConfirmAmount(data.amount)
      setConfirmMerchant(data.merchant)
      setConfirmDate(data.date)
      setConfirmCategory(null)
      setShowConfirmSheet(true)
    } finally {
      setIsScanning(false)
    }
  }, [])

  const handleConfirmExpense = useCallback(async () => {
    if (!confirmAmount || !confirmCategory) return

    setIsSubmitting(true)

    const expenseDate = confirmDate || new Date()
    const payload: ExpensePayload = {
      date: expenseDate.toISOString(),
      merchant: confirmMerchant || "Unknown",
      amount: parseFloat(confirmAmount),
      category: confirmCategory,
      paymentMethod: confirmPaymentMethod,
      notes: confirmNotes,
      receiptImageUrl: receiptImage,
    }

    const result = await addExpense(payload)

    setIsSubmitting(false)

    if (result.success) {
      const newExpense: Expense = {
        id: result.id || Date.now().toString(),
        amount: parseFloat(confirmAmount),
        category: confirmCategory,
        merchant: confirmMerchant || "Unknown",
        date: expenseDate,
        paymentMethod: confirmPaymentMethod,
        notes: confirmNotes,
        receiptImageUrl: receiptImage,
      }

      setExpenses(prev => [newExpense, ...prev])

      setShowConfirmSheet(false)
      if (receiptImage) {
        URL.revokeObjectURL(receiptImage)
      }
      setReceiptImage(null)
      setConfirmAmount("")
      setConfirmMerchant("")
      setConfirmCategory(null)
      setConfirmDate(null)
      setConfirmPaymentMethod("Card")
      setConfirmNotes("")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      toast({
        title: "Receipt expense added",
        description: `$${parseFloat(confirmAmount).toFixed(2)} at ${confirmMerchant || "Unknown"} saved successfully.`,
      })
    } else {
      toast({
        title: "Failed to add expense",
        description: result.error || "Please try again.",
        variant: "destructive",
      })
    }
  }, [confirmAmount, confirmCategory, confirmMerchant, confirmDate, confirmPaymentMethod, confirmNotes, receiptImage, toast])

  const handleCancelScan = useCallback(() => {
    if (receiptImage) {
      URL.revokeObjectURL(receiptImage)
    }
    setShowConfirmSheet(false)
    setReceiptImage(null)
    setIsScanning(false)
    setConfirmAmount("")
    setConfirmMerchant("")
    setConfirmCategory(null)
    setConfirmDate(null)
    setConfirmPaymentMethod("Card")
    setConfirmNotes("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [receiptImage])

  const getCategoryInfo = (categoryName: string) => {
    return categories.find(c => c.name === categoryName) || categories[categories.length - 1]
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content */}
      <div className="flex-1 pb-20">
        {activeTab === "expenses" ? (
          <div className="px-4 pt-12 max-w-md mx-auto">
            {/* Header */}
            <header className="mb-4">
              <h1 className="text-2xl font-semibold text-foreground">Expenses</h1>
              <p className="text-sm text-muted-foreground">Track your spending</p>
            </header>

            {/* Quick Add Bar - Ultra-fast entry */}
            <div className={cn(
              "rounded-2xl p-3 mb-4 border transition-all duration-200",
              quickSuccess
                ? "bg-primary/10 border-primary"
                : "bg-card border-border"
            )}>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleQuickAdd()
                }}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span>
                    <input
                      ref={quickInputRef}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={quickAmount}
                      onChange={(e) => setQuickAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={isQuickSubmitting}
                      className="w-full bg-secondary text-foreground text-lg font-medium rounded-xl py-3 pl-8 pr-3 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground disabled:opacity-50"
                    />
                  </div>
                  <select
                    value={quickCategory}
                    onChange={(e) => setQuickCategory(e.target.value)}
                    disabled={isQuickSubmitting}
                    className="bg-secondary text-foreground text-sm rounded-xl py-3 px-3 focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer disabled:opacity-50 min-w-[90px]"
                  >
                    {categories.map((cat) => (
                      <option key={cat.name} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={quickMerchant}
                    onChange={(e) => setQuickMerchant(e.target.value)}
                    placeholder="Merchant"
                    disabled={isQuickSubmitting}
                    className="flex-1 bg-secondary text-foreground text-sm font-medium rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground disabled:opacity-50"
                  />
                  <select
                    value={quickPaymentMethod}
                    onChange={(e) => setQuickPaymentMethod(e.target.value)}
                    disabled={isQuickSubmitting}
                    className="bg-secondary text-foreground text-sm rounded-xl py-3 px-3 focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer disabled:opacity-50 min-w-[90px]"
                  >
                    <option value="Card">Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Venmo">Venmo</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!quickAmount || isQuickSubmitting}
                    className={cn(
                      "p-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[52px]",
                      quickSuccess
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary text-primary-foreground"
                    )}
                  >
                    {isQuickSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : quickSuccess ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </form>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">Quick add: fill details, hit enter or add button</p>
            </div>

            {/* Monthly Summary Card */}
            <div className="bg-card rounded-2xl p-5 mb-6 border border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">This Month</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">${monthlyTotal.toFixed(2)}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((monthlyTotal / 2000) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">$2,000</span>
              </div>
            </div>

            {/* Action Buttons */}
            {!showForm && !receiptImage && (
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => setShowForm(true)}
                  className="flex-1 bg-primary text-primary-foreground rounded-2xl py-4 px-4 flex items-center justify-center gap-2 text-base font-medium active:scale-[0.98] transition-transform"
                >
                  <Plus className="w-5 h-5" />
                  Add Expense
                </button>
                <label className="flex-1 bg-card border border-border text-foreground rounded-2xl py-4 px-4 flex items-center justify-center gap-2 text-base font-medium active:scale-[0.98] transition-transform cursor-pointer">
                  <Camera className="w-5 h-5" />
                  Scan Receipt
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleReceiptUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Receipt Preview with Loading State */}
            {receiptImage && !showConfirmSheet && (
              <div className="bg-card rounded-2xl p-4 mb-6 border border-border animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="relative">
                  <img
                    src={receiptImage}
                    alt="Receipt preview"
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  <button
                    onClick={handleCancelScan}
                    className="absolute top-2 right-2 p-2 bg-background/80 backdrop-blur-sm rounded-full"
                  >
                    <X className="w-4 h-4 text-foreground" />
                  </button>
                </div>
                {isScanning && (
                  <div className="mt-4 flex items-center justify-center gap-3 py-4">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    <span className="text-sm text-muted-foreground">Scanning receipt...</span>
                  </div>
                )}
              </div>
            )}

            {/* Manual Add Expense Form */}
            {showForm && (
              <div className="bg-card rounded-2xl p-5 mb-6 border border-border animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Amount Input */}
                <div className="mb-5">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      autoFocus
                      className="w-full bg-secondary text-foreground text-2xl font-semibold rounded-xl py-4 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                    />
                  </div>
                </div>

                {/* Category Selection */}
                <div className="mb-5">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Category</label>
                  <div className="grid grid-cols-4 gap-2">
                    {categories.map((cat) => {
                      const Icon = cat.icon
                      return (
                        <button
                          key={cat.name}
                          onClick={() => setSelectedCategory(cat.name)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all active:scale-95",
                            selectedCategory === cat.name
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-[10px] font-medium">{cat.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Merchant Input */}
                <div className="mb-5">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Merchant</label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="Where did you spend?"
                    className="w-full bg-secondary text-foreground rounded-xl py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                  />
                </div>

                {/* Payment Method */}
                <div className="mb-5">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Payment Method</label>
                  <div className="flex gap-2">
                    {["Card", "Cash", "Venmo"].map((method) => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95",
                          paymentMethod === method
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-5">
                  <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Notes (optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add a note..."
                    className="w-full bg-secondary text-foreground rounded-xl py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowForm(false)
                      setAmount("")
                      setSelectedCategory(null)
                      setMerchant("")
                      setPaymentMethod("Card")
                      setNotes("")
                    }}
                    disabled={isSubmitting}
                    className="flex-1 bg-secondary text-secondary-foreground rounded-xl py-3.5 font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddExpense}
                    disabled={!amount || !selectedCategory || isSubmitting}
                    className="flex-1 bg-primary text-primary-foreground rounded-xl py-3.5 font-medium active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div className="pb-8">
              <h2 className="text-sm uppercase tracking-wide text-muted-foreground mb-3">Recent</h2>
              {isLoadingExpenses ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-card rounded-2xl border border-border">
                  <p>No expenses yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {expenses.slice(0, 5).map((expense) => {
                    const catInfo = getCategoryInfo(expense.category)
                    const Icon = catInfo.icon

                    return (
                    <div
                      key={expense.id}
                      className="bg-card rounded-xl p-4 flex items-center gap-4 border border-border group"
                    >
                      <div className={cn("w-11 h-11 rounded-full flex items-center justify-center shrink-0", catInfo.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{expense.merchant}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(expense.date)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">-${expense.amount.toFixed(2)}</span>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/20 rounded-lg transition-all"
                          aria-label="Delete expense"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          </div>
        ) : (
          <SpendingDashboard expenses={expenses} />
        )}
      </div>

      <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => !open && !isDeleting && setExpenseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this expense from your Notion database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-6 py-3 safe-area-pb">
        <div className="max-w-md mx-auto flex justify-around">
          <button
            onClick={() => setActiveTab("expenses")}
            className={cn(
              "flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-colors",
              activeTab === "expenses"
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Receipt className="w-6 h-6" />
            <span className="text-xs font-medium">Expenses</span>
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={cn(
              "flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-colors",
              activeTab === "analytics"
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <BarChart3 className="w-6 h-6" />
            <span className="text-xs font-medium">Analytics</span>
          </button>
        </div>
      </div>

      {/* Confirmation Bottom Sheet */}
      <Sheet open={showConfirmSheet} onOpenChange={setShowConfirmSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-8 pt-6 max-h-[90vh] overflow-y-auto">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <SheetHeader className="p-0 mb-5">
            <SheetTitle className="text-xl">Confirm Expense</SheetTitle>
            <SheetDescription>Review and edit the scanned details</SheetDescription>
          </SheetHeader>

          {receiptImage && (
            <div className="mb-5">
              <img
                src={receiptImage}
                alt="Scanned receipt"
                className="w-full h-32 object-cover rounded-xl opacity-60"
              />
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={confirmAmount}
                  onChange={(e) => setConfirmAmount(e.target.value)}
                  className="w-full bg-secondary text-foreground text-xl font-semibold rounded-xl py-3.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Merchant</label>
              <input
                type="text"
                value={confirmMerchant}
                onChange={(e) => setConfirmMerchant(e.target.value)}
                className="w-full bg-secondary text-foreground rounded-xl py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {confirmDate && (
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Date</label>
                <div className="flex items-center gap-3 bg-secondary rounded-xl py-3.5 px-4">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <span className="text-foreground">
                    {confirmDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Category</label>
              <div className="grid grid-cols-4 gap-2">
                {categories.map((cat) => {
                  const Icon = cat.icon
                  return (
                    <button
                      key={cat.name}
                      onClick={() => setConfirmCategory(cat.name)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all active:scale-95",
                        confirmCategory === cat.name
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium">{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Payment Method</label>
              <div className="flex gap-2">
                {["Card", "Cash", "Venmo"].map((method) => (
                  <button
                    key={method}
                    onClick={() => setConfirmPaymentMethod(method)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95",
                      confirmPaymentMethod === method
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Notes (optional)</label>
              <input
                type="text"
                value={confirmNotes}
                onChange={(e) => setConfirmNotes(e.target.value)}
                placeholder="Add a note..."
                className="w-full bg-secondary text-foreground rounded-xl py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleCancelScan}
              disabled={isSubmitting}
              className="flex-1 bg-secondary text-secondary-foreground rounded-xl py-4 font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmExpense}
              disabled={!confirmAmount || !confirmCategory || isSubmitting}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-4 font-medium active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Confirm
                </>
              )}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
