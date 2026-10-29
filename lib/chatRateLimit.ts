import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Limits for the public demo. Adjust as needed.
export const PER_IP_LIMIT = 10// messages per visitor per hour
export const GLOBAL_DAILY_LIMIT = 300 // messages across all visitors per 24 hours

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: 'ip' | 'global'; message: string }

function getClientIp(req: Request): string {
  // On Vercel the first entry of x-forwarded-for is the visitor's IP
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

// Store a hash, not the raw IP, so we don't keep personal data
function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

export async function checkChatRateLimit(req: Request): Promise<RateLimitResult> {
  const ipHash = hashIp(getClientIp(req))
  const now = Date.now()

  // Record this request first, then count. Counting after the insert
  // means two simultaneous requests can't both slip under the limit.
  const { error: insertError } = await supabaseAdmin
    .from('chat_requests')
    .insert({ ip_hash: ipHash })

  if (insertError) {
    // If the limiter itself is broken, fail closed: protecting the OpenAI bill
    // matters more than answering one message.
    console.error('Rate limit insert failed:', insertError.message)
    return { allowed: false, reason: 'global', message: 'The assistant is temporarily unavailable. Please try again later.' }
  }

  const [ipCount, globalCount] = await Promise.all([
    supabaseAdmin
      .from('chat_requests')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', new Date(now - HOUR_MS).toISOString()),
    supabaseAdmin
      .from('chat_requests')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(now - DAY_MS).toISOString()),
  ])

  // Occasionally clean up rows older than 2 days so the table stays small
  if (Math.random() < 0.05) {
    // Supabase queries only run when awaited, so await it (rare, cheap)
    await supabaseAdmin
      .from('chat_requests')
      .delete()
      .lt('created_at', new Date(now - 2 * DAY_MS).toISOString())
  }

  if ((ipCount.count ?? 0) > PER_IP_LIMIT) {
    return {
      allowed: false,
      reason: 'ip',
      message: `You've reached the demo limit of ${PER_IP_LIMIT} messages per hour. Please try again later.`,
    }
  }

  if ((globalCount.count ?? 0) > GLOBAL_DAILY_LIMIT) {
    return {
      allowed: false,
      reason: 'global',
      message: 'The demo assistant has reached its daily limit. Please come back tomorrow.',
    }
  }

  return { allowed: true }
}