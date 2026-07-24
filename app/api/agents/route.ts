import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'

const agentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['admin', 'agent']),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = agentSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: 'Invalid agent data' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('agents').insert(parsed.data)

  if (error) {
    console.error('SUPABASE INSERT ERROR:', JSON.stringify(error))
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true }, { status: 201 })
}