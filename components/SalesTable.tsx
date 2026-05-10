'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search } from 'lucide-react'

interface Sale {
  id: string
  property_address: string
  sale_amount: number
  sale_date: string
  status: string
  agents: { name: string }
}

interface SalesTableProps {
  role: 'admin' | 'agent'
}

export default function SalesTable({ role }: SalesTableProps) {
  const [sales, setSales] = useState<Sale[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchSales() {
      const { data } = await supabase
        .from('sales')
        .select('*, agents(name)')
        .order('sale_date', { ascending: false })

      setSales(data || [])
      setIsLoading(false)
    }

    fetchSales()
  }, [])

  const filtered = sales.filter(sale =>
    sale.property_address.toLowerCase().includes(search.toLowerCase()) ||
    sale.agents?.name.toLowerCase().includes(search.toLowerCase())
  )

  const displayed = role === 'admin'
    ? filtered
    : filtered.slice(0, 1)

  const statusColor = (status: string) => {
    if (status === 'paid') return 'bg-green-100 text-green-700'
    if (status === 'approved') return 'bg-blue-100 text-blue-700'
    return 'bg-yellow-100 text-yellow-700'
  }

  if (isLoading) return <p className="text-gray-400">Loading sales...</p>

  return (
    <div className="bg-white rounded-xl shadow-md p-6">

      {/* Header + Search */}
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-3">Property</th>
              <th className="pb-3">Agent</th>
              <th className="pb-3">Amount</th>
              <th className="pb-3">Date</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((sale) => (
              <tr key={sale.id} className="border-b hover:bg-gray-50">
                <td className="py-3">{sale.property_address}</td>
                <td className="py-3">{sale.agents?.name}</td>
                <td className="py-3">
                  ${sale.sale_amount.toLocaleString()}
                </td>
                <td className="py-3">{sale.sale_date}</td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(sale.status)}`}>
                    {sale.status}
                  </span>
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