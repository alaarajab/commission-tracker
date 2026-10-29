// Public demo logins (must match supabase/phase4_demo_setup.sql)
export const DEMO_ACCOUNTS = {
  admin: 'demo-admin@example.com',
  agent: 'demo-agent@example.com',
} as const

export type DemoRole = keyof typeof DEMO_ACCOUNTS

// The demo password is public on purpose (anyone can click "Try as Admin").
// It lives in an env var so you can change it without a code change.
// If it isn't set, the demo buttons are hidden.
export const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? ''

export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.toLowerCase()
  return e === DEMO_ACCOUNTS.admin || e === DEMO_ACCOUNTS.agent
}
