import { tool, type InferUITools, type UIDataTypes, type UIMessage } from 'ai'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ---------- Shared helpers ----------

type Agent = { id: string; name: string; email: string }

type AgentLookup =
  | { ok: true; agent: Agent }
  | { ok: false; error: string; matches?: Agent[] }

// Find one agent by name.
// 1. Exact name match (case-insensitive) wins.
// 2. Otherwise a partial match, but only if exactly one agent matches.
// 3. Several matches → return them so the assistant can ask which one.
async function findAgent(name: string): Promise<AgentLookup> {
  const search = name.trim()
  const { data, error } = await supabaseAdmin
    .from('agents')
    .select('id, name, email')
    .ilike('name', `%${search}%`)

  if (error) return { ok: false, error: 'Could not look up agents.' }
  const agents = (data ?? []) as Agent[]

  const exact = agents.filter((a) => a.name.toLowerCase() === search.toLowerCase())
  if (exact.length === 1) return { ok: true, agent: exact[0] }
  if (agents.length === 1) return { ok: true, agent: agents[0] }
  if (agents.length === 0) return { ok: false, error: `No agent found matching "${search}".` }

  return {
    ok: false,
    error: `Several agents match "${search}". Ask the user which one they mean.`,
    matches: agents,
  }
}

// The model must pick a period on purpose; the code does the date math.
const PERIODS = ['all_time', 'this_month', 'last_month', 'this_year', 'month', 'year'] as const
type Period = (typeof PERIODS)[number]
type DateRange = { from: string; to: string; label: string } | null

function monthRange(y: number, m: number): DateRange {
  const lastDay = new Date(y, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(lastDay).padStart(2, '0')}`, label: `${y}-${mm}` }
}

function yearRange(y: number): DateRange {
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}` }
}

// Turn a period into a date range on sale_date (YYYY-MM-DD).
// Compares plain date strings, so there are no time-zone shifts.
function saleDateRange(period: Period, month?: number, year?: number): DateRange {
  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth() + 1

  switch (period) {
    case 'this_month':
      return monthRange(thisYear, thisMonth)
    case 'last_month':
      return thisMonth === 1 ? monthRange(thisYear - 1, 12) : monthRange(thisYear, thisMonth - 1)
    case 'this_year':
      return yearRange(thisYear)
    case 'month':
      return month ? monthRange(year ?? thisYear, month) : null
    case 'year':
      return yearRange(year ?? thisYear)
    case 'all_time':
    default:
      return null
  }
}

function inRange(date: string | null | undefined, range: DateRange) {
  if (!range) return true
  if (!date) return false
  return date >= range.from && date <= range.to
}

// Same rule as the dashboard stat cards: paid = has paid_at, pending = no paid_at
function splitPaid(rows: { amount: number; paid_at: string | null }[]) {
  const paid = rows.filter((r) => r.paid_at).reduce((s, r) => s + r.amount, 0)
  const pending = rows.filter((r) => !r.paid_at).reduce((s, r) => s + r.amount, 0)
  return { paidAmount: paid, pendingAmount: pending, totalAmount: paid + pending }
}

const periodParam = z
  .enum(PERIODS)
  .describe(
    'Time period. Use "all_time" unless the user mentions a time period. ' +
    '"this_month", "last_month", "this_year" for those phrases; ' +
    '"month" when the user names a month (e.g. "in September"); "year" when they name a year.'
  )
const monthParam = z
  .number().int().min(1).max(12).optional()
  .describe('Only with period "month": the month number 1-12.')
const yearParam = z
  .number().int().min(2000).max(2100).optional()
  .describe('Only with period "month" or "year": the year, if the user named one.')

type CommissionRow = {
  amount: number
  paid_at: string | null
  agents: { id: string; name: string } | null
  sales: { property_address: string; sale_amount: number; sale_date: string; status: string } | null
}

// ---------- Tools ----------

export const chatTools = {
  getAgentCommissions: tool({
    description:
      'Commission totals for one agent or all agents, split into paid and pending (unpaid) dollars. ' +
      'Choose the period explicitly (usually all_time). Time filters apply to the sale date.',
    inputSchema: z.object({
      agentName: z.string().optional().describe('Agent name. Omit for all agents.'),
      period: periodParam,
      month: monthParam,
      year: yearParam,
    }),
    execute: async ({ agentName, period, month, year }) => {
      let agentId: string | undefined
      let agentLabel = 'all agents'

      if (agentName) {
        const found = await findAgent(agentName)
        if (!found.ok) return found
        agentId = found.agent.id
        agentLabel = found.agent.name
      }

      let query = supabaseAdmin
        .from('commissions')
        .select('amount, paid_at, agents ( id, name ), sales ( property_address, sale_amount, sale_date, status )')
      if (agentId) query = query.eq('agent_id', agentId)

      const { data, error } = await query
      if (error) return { ok: false, error: 'Could not load commissions.' }

      const range = saleDateRange(period, month, year)
      const allRows = (data ?? []) as unknown as CommissionRow[]
      const rows = allRows.filter((r) => inRange(r.sales?.sale_date, range))

      return {
        ok: true,
        agent: agentLabel,
        period: range?.label ?? 'all time',
        ...splitPaid(rows),
        // Safety net: if a period was used, also give all-time totals so a
        // wrongly-chosen month never turns into a misleading "$0".
        ...(range ? { allTimeTotals: splitPaid(allRows) } : {}),
        commissionCount: rows.length,
        // Keep the list short to save tokens
        commissions: rows.slice(0, 15).map((r) => ({
          agent: r.agents?.name,
          property: r.sales?.property_address,
          saleDate: r.sales?.sale_date,
          saleStatus: r.sales?.status,
          amount: r.amount,
          paid: Boolean(r.paid_at),
        })),
      }
    },
  }),

  getPendingSales: tool({
    description: 'Sales still waiting for admin approval (status "pending"), optionally for one agent.',
    inputSchema: z.object({
      agentName: z.string().optional().describe('Agent name. Omit for all agents.'),
    }),
    execute: async ({ agentName }) => {
      let query = supabaseAdmin
        .from('sales')
        .select('property_address, sale_amount, sale_date, agents ( name )')
        .eq('status', 'pending')
        .order('sale_date', { ascending: false })

      if (agentName) {
        const found = await findAgent(agentName)
        if (!found.ok) return found
        query = query.eq('agent_id', found.agent.id)
      }

      const { data, error } = await query
      if (error) return { ok: false, error: 'Could not load pending sales.' }

      const sales = (data ?? []) as unknown as {
        property_address: string; sale_amount: number; sale_date: string; agents: { name: string } | null
      }[]

      return {
        ok: true,
        count: sales.length,
        totalSaleAmount: sales.reduce((s, r) => s + r.sale_amount, 0),
        pendingSales: sales.map((s) => ({
          agent: s.agents?.name,
          property: s.property_address,
          saleAmount: s.sale_amount,
          saleDate: s.sale_date,
        })),
      }
    },
  }),

  getTopAgents: tool({
    description:
      'Agents ranked by total commission (paid + pending). Choose the period explicitly (usually all_time). ' +
      'Time filters apply to the sale date.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(20).default(5).describe('How many agents to return'),
      period: periodParam,
      month: monthParam,
      year: yearParam,
    }),
    execute: async ({ limit, period, month, year }) => {
      const { data, error } = await supabaseAdmin
        .from('commissions')
        .select('amount, paid_at, agents ( id, name ), sales ( sale_date )')
      if (error) return { ok: false, error: 'Could not load commissions.' }

      const range = saleDateRange(period, month, year)
      const rows = ((data ?? []) as unknown as CommissionRow[]).filter((r) => inRange(r.sales?.sale_date, range))

      const byAgent = new Map<string, { name: string; rows: CommissionRow[] }>()
      for (const r of rows) {
        if (!r.agents) continue
        const entry = byAgent.get(r.agents.id) ?? { name: r.agents.name, rows: [] }
        entry.rows.push(r)
        byAgent.set(r.agents.id, entry)
      }

      const ranked = [...byAgent.values()]
        .map((a) => ({ name: a.name, ...splitPaid(a.rows) }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, limit)
        .map((a, i) => ({ rank: i + 1, ...a }))

      return { ok: true, period: range?.label ?? 'all time', topAgents: ranked }
    },
  }),

  getSalesSummary: tool({
    description:
      'Overall totals: number of sales by status, total sale value, and commissions split into paid and pending dollars.',
    inputSchema: z.object({}),
    execute: async () => {
      const [salesRes, commRes] = await Promise.all([
        supabaseAdmin.from('sales').select('sale_amount, status'),
        supabaseAdmin.from('commissions').select('amount, paid_at'),
      ])
      if (salesRes.error || commRes.error) return { ok: false, error: 'Could not load summary.' }

      const sales = salesRes.data as { sale_amount: number; status: string }[]
      const commissions = commRes.data as { amount: number; paid_at: string | null }[]
      const countStatus = (s: string) => sales.filter((x) => x.status === s).length

      return {
        ok: true,
        salesCount: sales.length,
        salesByStatus: { pending: countStatus('pending'), approved: countStatus('approved'), paid: countStatus('paid') },
        totalSaleAmount: sales.reduce((s, x) => s + x.sale_amount, 0),
        commissions: splitPaid(commissions),
      }
    },
  }),
}

// Message type shared by the API route and the chat UI, so tool parts are typed
export type ChatMessage = UIMessage<never, UIDataTypes, InferUITools<typeof chatTools>>