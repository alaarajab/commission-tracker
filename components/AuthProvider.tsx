'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type CurrentAgent = { id: string; name: string; email: string; role: 'admin' | 'agent' }

type AuthState = {
  loading: boolean
  session: Session | null
  // The agent row linked to this login (null if not linked yet)
  agent: CurrentAgent | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [agent, setAgent] = useState<CurrentAgent | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadAgent(s: Session | null) {
      if (!s) {
        setAgent(null)
        return
      }
      // RLS lets every user read their own agent row
      const { data } = await supabase
        .from('agents')
        .select('id, name, email, role')
        .eq('user_id', s.user.id)
        .maybeSingle()
      if (cancelled) return
      setAgent(data ? { ...data, role: data.role === 'admin' ? 'admin' : 'agent' } : null)
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      await loadAgent(data.session)
      if (!cancelled) setLoading(false)
    })

    // Keep in sync when the user signs in/out (also in other tabs) or the token refreshes
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Run outside the callback, as Supabase recommends
        setTimeout(() => loadAgent(s), 0)
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return <AuthContext.Provider value={{ loading, session, agent, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
