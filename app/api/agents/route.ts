import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'

const agentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['admin', 'agent']),
})

export async function POST(req: Request) {
  // TODO: check the caller is a logged-in admin here, return 403 if not

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = agentSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid agent data' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('agents').insert(parsed.data)

  // 23505 = Postgres "unique violation": the agents_email_unique rule blocked a duplicate email
  if (error?.code === '23505') {
    return Response.json(
      { error: 'This email is already used by another agent.', field: 'email' },
      { status: 409 }
    )
  }

  if (error) {
    console.error('SUPABASE INSERT ERROR:', error)
    return Response.json({ error: 'Failed to create agent' }, { status: 500 })
  }

  return Response.json({ ok: true }, { status: 201 })
}