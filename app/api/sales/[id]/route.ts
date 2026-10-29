import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/serverAuth'
import { z } from 'zod'

const statusSchema = z.object({
  status: z.enum(['pending', 'approved', 'paid']),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req)
  if (admin instanceof Response) return admin
  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = statusSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { status } = parsed.data

  const { data: sale, error: saleError } = await supabaseAdmin
    .from('sales')
    .update({ status })
    .eq('id', id)
    .select('id, agent_id, sale_amount')
    .single()

  if (saleError || !sale) {
    return Response.json({ error: 'Failed to update sale' }, { status: 500 })
  }

  if (status === 'paid') {
    const { data: existing } = await supabaseAdmin
      .from('commissions')
      .select('id')
      .eq('sale_id', id)
      .single()

    if (existing) {
      await supabaseAdmin
        .from('commissions')
        .update({ paid_at: new Date().toISOString() })
        .eq('sale_id', id)
    } else {
      await supabaseAdmin.from('commissions').insert({
        sale_id: id,
        agent_id: sale.agent_id,
        amount: sale.sale_amount * 0.03,
        paid_at: new Date().toISOString(),
      })
    }
  }

  if (status === 'approved') {
    await supabaseAdmin.from('commissions').update({ paid_at: null }).eq('sale_id', id)
  }

  return Response.json({ ok: true })
}