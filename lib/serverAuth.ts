import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type CallerAgent = { id: string; name: string; email: string; role: 'admin' | 'agent' }

export type Caller = {
  userId: string
  agent: CallerAgent
  // Supabase client that acts AS this user, so database RLS rules apply
  db: SupabaseClient
}

// Who is calling this API route? Reads "Authorization: Bearer <access token>",
// verifies it with Supabase, and finds the agent row linked to that login.
// Returns null if not logged in, or the login isn't linked to an agent.
export async function getCaller(req: Request): Promise<Caller | null> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user) return null

  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('id, name, email, role')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (!agent) return null

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  )

  return {
    userId: userData.user.id,
    agent: { ...agent, role: agent.role === 'admin' ? 'admin' : 'agent' },
    db,
  }
}

// For admin-only routes: returns the caller, or a 401/403 Response to send back
export async function requireAdmin(req: Request): Promise<Caller | Response> {
  const caller = await getCaller(req)
  if (!caller) return Response.json({ error: 'Please sign in.' }, { status: 401 })
  if (caller.agent.role !== 'admin') {
    return Response.json({ error: 'Only admins can do this.' }, { status: 403 })
  }
  return caller
}
