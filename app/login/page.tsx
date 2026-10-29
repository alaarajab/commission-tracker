'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

type Mode = 'signin' | 'signup'

// Turn Supabase error messages into something a user can act on
function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('database error saving new user') || m.includes('not_invited')) {
    return "This email hasn't been invited. Ask your admin to add you as an agent first, using this exact email."
  }
  if (m.includes('invalid login credentials')) return 'Wrong email or password.'
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox for the link.'
  if (m.includes('already registered')) return 'This email already has an account. Sign in instead.'
  if (m.includes('rate limit')) return 'Too many attempts. Please wait a few minutes and try again.'
  return message
}

export default function LoginPage() {
  const router = useRouter()
  const { session, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Already signed in? Go to the dashboard
  useEffect(() => {
    if (!loading && session) router.replace('/')
  }, [loading, session, router])

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setNotice(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (mode === 'signup') {
      if (password.length < 8) return setError('Password must be at least 8 characters.')
      if (password !== confirm) return setError("Passwords don't match.")
    }

    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return setError(friendlyError(error.message))
        router.replace('/')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) return setError(friendlyError(error.message))
        if (data.session) {
          router.replace('/')
        } else {
          setNotice(`Almost done! We sent a confirmation link to ${email}. Click it, then sign in.`)
          setMode('signin')
          setPassword('')
          setConfirm('')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <LayoutDashboard className="text-blue-600" size={28} />
          <h1 className="text-2xl font-bold text-gray-800">Commission Tracker</h1>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-lg p-1 mb-5">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`text-sm py-1.5 rounded-md transition-colors ${
                  mode === m ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {mode === 'signup' && (
            <p className="text-xs text-gray-500 mb-4">
              Use the email your admin added you with. Only invited agents can create an account.
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="confirm" className="text-sm font-medium text-gray-700">
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            )}

            {error && (
              <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {notice && (
              <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{notice}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
