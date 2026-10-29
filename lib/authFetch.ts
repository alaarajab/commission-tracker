import { supabase } from '@/lib/supabase'

// The current login token, as an Authorization header for our API routes
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// fetch() that proves who is calling, so API routes can check the user's role
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  for (const [key, value] of Object.entries(await authHeaders())) headers.set(key, value)
  return fetch(url, { ...init, headers })
}
