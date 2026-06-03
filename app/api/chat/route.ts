import { openai } from '@ai-sdk/openai'
import { streamText, createUIMessageStreamResponse, convertToModelMessages, stepCountIs } from 'ai'
import { zodSchema } from '@ai-sdk/provider-utils'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { messages } = await req.json()
  console.log('Received messages:', JSON.stringify(messages, null, 2))

 const modelMessages = messages.map((m: any) => ({
  role: m.role,
  content: m.parts
    ?.filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('') ?? '',
}))

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: `You are a commission analytics assistant for a real estate sales team.
    You help agents and admins understand their commission data.
    Always use tools to fetch real data — never make up numbers.
    Format currency as USD with commas. Be concise and friendly.
    Agents are real estate sales reps. Sales refer to property sales.
    Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
When asked about "this month" use month ${new Date().getMonth() + 1} and year ${new Date().getFullYear()}.
When asked about "last month" use month ${new Date().getMonth() === 0 ? 12 : new Date().getMonth()} and year ${new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()}.
When asked about top agents always call getTopAgents immediately with the requested number.
Never ask multiple clarifying questions — make your best guess and call the tool.`,
    messages: modelMessages,
   stopWhen: stepCountIs(5), 
    tools: {
      getAgentCommissions: {
        description: 'Get total commissions earned by a specific agent or all agents, optionally filtered by month and year',
        inputSchema: zodSchema(z.object({
          agentName: z.string().optional().describe('Agent name to filter by, omit for all agents'),
          month: z.number().min(1).max(12).optional().describe('Month number 1-12, e.g. 4 for April'),
          year: z.number().optional().describe('Year e.g. 2026, defaults to current year'),
        })),
        execute: async (params: any) => {
          const { agentName, month, year } = params
          let agentId: string | null = null

          if (agentName) {
            const { data: agent } = await supabase
              .from('agents')
              .select('id, name')
              .ilike('name', `%${agentName}%`)
              .single()
            if (!agent) return { error: `Agent "${agentName}" not found` }
            agentId = agent.id
          }

          let query = supabase
            .from('commissions')
            .select(`
              amount,
              paid_at,
              agents ( name, email ),
              sales ( property_address, sale_amount, sale_date, status )
            `)

          if (agentId) query = query.eq('agent_id', agentId)

          if (month || year) {
            const resolvedYear = year ?? new Date().getFullYear()
            const resolvedMonth = month ?? 1
            if (month && year) {
              const start = new Date(resolvedYear, resolvedMonth - 1, 1).toISOString()
              const end = new Date(resolvedYear, resolvedMonth, 0, 23, 59, 59).toISOString()
              query = query.gte('paid_at', start).lte('paid_at', end)
            } else if (year && !month) {
              const start = new Date(resolvedYear, 0, 1).toISOString()
              const end = new Date(resolvedYear, 11, 31, 23, 59, 59).toISOString()
              query = query.gte('paid_at', start).lte('paid_at', end)
            }
          }

          const { data, error } = await query
          if (error) return { error: error.message }

          const total = (data as any[]).reduce((sum: number, r: any) => sum + r.amount, 0)
          return {
            commissions: data,
            totalAmount: total,
            count: data.length,
            filters: {
              agent: agentName ?? 'all agents',
              month: month ?? 'all months',
              year: year ?? 'all years',
            }
          }
        },
      },

      getPendingSales: {
        description: 'Get all sales with pending status and their commission info',
        inputSchema: zodSchema(z.object({
          agentName: z.string().optional().describe('Filter by agent name'),
        })),
        execute: async (params: any) => {
          const { agentName } = params
          let query = supabase
            .from('sales')
            .select(`
              id,
              property_address,
              sale_amount,
              sale_date,
              status,
              agents ( name, email )
            `)
            .eq('status', 'pending')

          if (agentName) {
            const { data: agent } = await supabase
              .from('agents')
              .select('id')
              .ilike('name', `%${agentName}%`)
              .single()
            if (agent) query = query.eq('agent_id', agent.id)
          }

          const { data, error } = await query
          if (error) return { error: error.message }
          return { pendingSales: data, count: data.length }
        },
      },

      getTopAgents: {
        description: 'Get top performing agents ranked by total commission earned',
        inputSchema: zodSchema(z.object({
          limit: z.number().default(5).describe('How many top agents to return'),
        })),
        execute: async (params: any) => {
          const { limit } = params
          const { data, error } = await supabase
            .from('commissions')
            .select(`
              amount,
              agents ( id, name, email )
            `)

          if (error) return { error: error.message }

          const totals: Record<string, { name: string; email: string; total: number }> = {}
          ;(data as any[]).forEach((r: any) => {
            const id = r.agents?.id || 'unknown'
            if (!totals[id]) totals[id] = { name: r.agents?.name, email: r.agents?.email, total: 0 }
            totals[id].total += r.amount
          })

          const ranked = Object.values(totals)
            .sort((a, b) => b.total - a.total)
            .slice(0, limit)

          return { topAgents: ranked }
        },
      },

      getSalesSummary: {
        description: 'Get summary of all sales — total count, total sale amount, total commissions paid',
        inputSchema: zodSchema(z.object({})),
        execute: async () => {
          const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('sale_amount, status')

          const { data: commissions, error: commError } = await supabase
            .from('commissions')
            .select('amount, paid_at')

          if (salesError || commError) return { error: 'Failed to fetch summary' }

          const totalSaleAmount = (sales as any[]).reduce((sum: number, s: any) => sum + s.sale_amount, 0)
          const totalCommissions = (commissions as any[]).reduce((sum: number, c: any) => sum + c.amount, 0)
          const paidSales = (sales as any[]).filter((s: any) => s.status === 'paid').length
          const pendingSales = (sales as any[]).filter((s: any) => s.status === 'pending').length
          const paidCommissions = (commissions as any[]).filter((c: any) => c.paid_at !== null).length

          return {
            totalSales: sales.length,
            paidSales,
            pendingSales,
            totalSaleAmount,
            totalCommissions,
            paidCommissions,
            unpaidCommissions: commissions.length - paidCommissions,
          }
        },
      },
    } as any,
  })
result.text.then((text: string) => console.log('AI response:', text))
  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream(),
  })
}