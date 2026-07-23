import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { z } from 'zod'

const saleSchema = z.object({
  property_address: z.string().min(5),
  sale_amount: z.coerce.number().min(1000),
  sale_date: z.string().min(1),
  agent_id: z.string().min(1),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = saleSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: 'Invalid sale data' }, { status: 400 })
  }

  const { property_address, sale_amount, sale_date, agent_id } = parsed.data

  const { data: newSale, error } = await supabaseAdmin
    .from('sales')
    .insert({ property_address, sale_amount, sale_date, agent_id, status: 'pending' })
    .select('id, agent_id')
    .single()

  if (error || !newSale) {
    return Response.json({ error: 'Failed to create sale' }, { status: 500 })
  }

  const { error: commissionError } = await supabaseAdmin.from('commissions').insert({
    sale_id: newSale.id,
    agent_id: newSale.agent_id,
    amount: sale_amount * 0.03,
    paid_at: null,
  })

  if (commissionError) {
    return Response.json({ error: 'Sale created but commission failed' }, { status: 500 })
  }

  return Response.json({ id: newSale.id }, { status: 201 })
}