"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Loader2, ArrowRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const [passphrase, setPassphrase] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passphrase) return

    setIsLoading(true)

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passphrase }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        router.push("/")
        router.refresh()
      } else {
        toast({
          title: "Access Denied",
          description: data.error || "Invalid passphrase.",
          variant: "destructive",
        })
        setPassphrase("")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Expense Tracker</h1>
          <p className="text-muted-foreground text-sm mt-1">Enter passphrase to access</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Passphrase"
              className="w-full bg-secondary text-foreground rounded-2xl py-4 px-5 focus:outline-none focus:ring-2 focus:ring-primary text-center tracking-widest placeholder:tracking-normal"
              disabled={isLoading}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={!passphrase || isLoading}
            className="w-full bg-primary text-primary-foreground rounded-2xl py-4 flex items-center justify-center gap-2 font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Unlock
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
