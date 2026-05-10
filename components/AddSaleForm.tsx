'use client'

import { useState, useEffect } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Plus, X } from 'lucide-react'


// Zod Schema - defines the rules for the form
const saleSchema = z.object({
  property_address: z.string().min(5, 'Address must be at least 5 characters'),
  sale_amount: z.coerce.number().min(1000, 'Amount must be at least $1,000'),
  sale_date: z.string().min(1, 'Date is required'),
  agent_id: z.string().min(1, 'Please select an agent'),
})

type SaleForm = z.infer<typeof saleSchema>

interface Agent {
  id: string
  name: string
}

export default function AddSaleForm({ onSaleAdded }: { onSaleAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SaleForm>({
    resolver: zodResolver(saleSchema) as any,
  })

  useEffect(() => {
    async function fetchAgents() {
      const { data } = await supabase
        .from('agents')
        .select('id, name')
      setAgents(data || [])
    }
    fetchAgents()
  }, [open])

  const onSubmit: SubmitHandler<SaleForm> = async (data) => {
  try {
    const { data: newSale, error } = await supabase
      .from('sales')
      .insert({
        property_address: data.property_address,
        sale_amount: data.sale_amount,
        sale_date: data.sale_date,
        agent_id: data.agent_id,
        status: 'pending',
      })
      .select('id, agent_id')
      .single()

    if (error) throw error

    if (newSale) {
      await supabase
        .from('commissions')
        .insert({
          sale_id: newSale.id,
          agent_id: newSale.agent_id,
          amount: data.sale_amount * 0.03,
          paid_at: null,
        })
    }

    toast.success('Sale added successfully!')
    reset()
    setOpen(false)
    onSaleAdded()
  } catch (err) {
    toast.error('Failed to add sale. Please try again.')
  }
}

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>

      {/* Button to open modal */}
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium w-fit">
          <Plus size={16} />
          Add New Sale
        </button>
      </Dialog.Trigger>

      {/* Modal */}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-full max-w-md shadow-xl">

          {/* Modal Header */}
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-semibold text-gray-800">
              Add New Sale
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
  Fill in the form to add a new sale
</Dialog.Description>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Property Address */}
            <div>
              <label className="text-sm font-medium text-gray-700">
                Property Address
              </label>
              <input
  {...register('property_address')}
  type="text"
  placeholder="123 Oak Street"
  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
/>
              {errors.property_address && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.property_address.message}
                </p>
              )}
            </div>

            {/* Sale Amount */}
            <div>
              <label className="text-sm font-medium text-gray-700">
                Sale Amount ($)
              </label>
              <input
                {...register('sale_amount')}
                type="number"
                placeholder="450000"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              {errors.sale_amount && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.sale_amount.message}
                </p>
              )}
            </div>

            {/* Sale Date */}
            <div>
              <label className="text-sm font-medium text-gray-700">
                Sale Date
              </label>
              <input
                {...register('sale_date')}
                type="date"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              {errors.sale_date && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.sale_date.message}
                </p>
              )}
            </div>

            {/* Agent */}
            <div>
              <label className="text-sm font-medium text-gray-700">
                Agent
              </label>
              <select
                {...register('agent_id')}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Select an agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              {errors.agent_id && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.agent_id.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Add Sale'}
            </button>

          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}