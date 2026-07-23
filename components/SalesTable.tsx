'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search } from 'lucide-react'
import { toast } from 'sonner'

interface Sale {
  id: string
  agent_id: string
  property_address: string
  sale_amount: number
  sale_date: string
  status: string
  agents: { name: string }[]
}

interface SalesTableProps {
  role: 'admin' | 'agent'
  refreshKey: number
  currentAgent: string
  onRefresh: () => void
}

export default function SalesTable({ role, refreshKey, currentAgent, onRefresh }: SalesTableProps) {
  const [sales, setSales] = useState<Sale[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchSales() {
      const { data: salesData } = await supabase
        .from('sales')
        .select('id, property_address, sale_amount, sale_date, status, agent_id')
        .order('sale_date', { ascending: false })

      const { data: agentsData } = await supabase
        .from('agents')
        .select('id, name')

      const combined = salesData?.map(sale => ({
        ...sale,
        agents: [{ name: agentsData?.find(a => a.id === sale.agent_id)?.name || 'Unknown' }]
      })) || []

      setSales(combined)
      setIsLoading(false)
    }
    fetchSales()
  }, [refreshKey])

  const filtered = sales.filter(sale =>
    sale.property_address.toLowerCase().includes(search.toLowerCase()) ||
    sale.agents?.[0]?.name.toLowerCase().includes(search.toLowerCase())
  )

  const displayed = role === 'admin'
    ? filtered
    : filtered.filter(sale => sale.agents?.[0]?.name === currentAgent)

  const statusColor = (status: string) => {
    if (status === 'paid') return 'bg-green-100 text-green-700'
    if (status === 'approved') return 'bg-blue-100 text-blue-700'
    return 'bg-yellow-100 text-yellow-700'
  }

  const updateStatus = async (saleId: string, newStatus: string) => {
    const res = await fetch(`/api/sales/${saleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (res.ok) {
      toast.success(`Sale ${newStatus}!`)
      setSales(prev =>
        prev.map(s => s.id === saleId ? { ...s, status: newStatus } : s)
      )
      onRefresh()
    } else {
      toast.error('Failed to update status')
    }
  }

  if (isLoading) return <p className="text-gray-400">Loading sales...</p>

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">
          Sales {role === 'agent' && '(Your Sales)'}
        </h2>
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search sales..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="outline-none text-sm w-48"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-3">Property</th>
              <th className="pb-3">Agent</th>
              <th className="pb-3">Amount</th>
              <th className="pb-3">Date</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((sale) => (
              <tr key={sale.id} className="border-b hover:bg-gray-50">
                <td className="py-3">{sale.property_address}</td>
                <td className="py-3">{sale.agents?.[0]?.name}</td>
                <td className="py-3">${sale.sale_amount.toLocaleString()}</td>
                <td className="py-3">{sale.sale_date}</td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(sale.status)}`}>
                    {sale.status}
                  </span>
                </td>
                <td className="py-3">
                  {role === 'admin' && sale.status === 'pending' && (
                    <button
                      onClick={() => updateStatus(sale.id, 'approved')}
                      className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200"
                    >
                      Approve
                    </button>
                  )}
                  {role === 'admin' && sale.status === 'approved' && (
                    <button
                      onClick={() => updateStatus(sale.id, 'paid')}
                      className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200"
                    >
                      Mark Paid
                    </button>
                  )}
                  {role === 'admin' && sale.status === 'paid' && (
                    <span className="text-xs text-gray-400">Paid ✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {displayed.length === 0 && (
          <p className="text-center text-gray-400 py-8">No sales found</p>
        )}
      </div>
    </div>
  )
}