'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DollarSign, CheckCircle, Clock } from 'lucide-react'

interface StatCardProps {
  role: 'admin' | 'agent'
  refreshKey: number
}

async function fetchStats() {
  const { data } = await supabase
    .from('commissions')
    .select('amount, paid_at')

  const total = data?.reduce((sum, c) => sum + c.amount, 0) || 0
  const paid = data
    ?.filter(c => c.paid_at)
    .reduce((sum, c) => sum + c.amount, 0) || 0
  const pending = data
    ?.filter(c => !c.paid_at)
    .reduce((sum, c) => sum + c.amount, 0) || 0

  return { total, paid, pending }
}

export default function StatCard({ role, refreshKey }: StatCardProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['commission-stats', refreshKey],
    queryFn: fetchStats,
    staleTime: 0,
    refetchOnMount: true,
  })

  if (isLoading) return <p className="text-gray-400">Loading stats...</p>

  return (
    <>
      {/* Total */}
      <div className="bg-white rounded-xl shadow-md p-6 flex items-center gap-4">
        <div className="bg-blue-100 p-3 rounded-full">
          <DollarSign className="text-blue-600" size={24} />
        </div>
        <div>
          <p className="text-sm text-gray-500">Total Commissions</p>
          <p className="text-2xl font-bold text-gray-800">
            ${stats?.total.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Paid */}
      <div className="bg-white rounded-xl shadow-md p-6 flex items-center gap-4">
        <div className="bg-green-100 p-3 rounded-full">
          <CheckCircle className="text-green-600" size={24} />
        </div>
        <div>
          <p className="text-sm text-gray-500">Commissions Paid</p>
          <p className="text-2xl font-bold text-gray-800">
            ${stats?.paid.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Pending */}
      <div className="bg-white rounded-xl shadow-md p-6 flex items-center gap-4">
        <div className="bg-yellow-100 p-3 rounded-full">
          <Clock className="text-yellow-600" size={24} />
        </div>
        <div>
          <p className="text-sm text-gray-500">Pending Commissions</p>
          <p className="text-2xl font-bold text-gray-800">
            ${stats?.pending.toLocaleString()}
          </p>
        </div>
      </div>
    </>
  )
}