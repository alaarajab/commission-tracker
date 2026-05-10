'use client'

import { useState } from 'react'
import StatCard from '@/components/StatCard'
import SalesTable from '@/components/SalesTable'
import CommissionChart from '@/components/CommissionChart'
import AddSaleForm from '@/components/AddSaleForm'
import { LayoutDashboard } from 'lucide-react'
import AddAgentForm from '@/components/AddAgentForm'

export default function Dashboard() {
  const [role, setRole] = useState<'admin' | 'agent'>('admin')
  const [refreshKey, setRefreshKey] = useState(0)
  const [currentAgent, setCurrentAgent] = useState('Mike Torres')

  return (
    <main className="min-h-screen bg-gray-50 p-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="text-blue-600" size={32} />
          <h1 className="text-3xl font-bold text-gray-800">
            Commission Tracker
          </h1>
        </div>

        {/* Role Toggle */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">View as:</span>
          <select
  value={role}
  onChange={(e) => {
    const newRole = e.target.value as 'admin' | 'agent'
    setRole(newRole)
    setCurrentAgent(newRole === 'agent' ? 'Mike Torres' : '')
  }}
  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
>
  <option value="admin">Admin</option>
  <option value="agent">Agent</option>
</select>
           
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard role={role} refreshKey={refreshKey}  currentAgent={currentAgent}/>
      </div>

      {/* Chart + Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
  <CommissionChart refreshKey={refreshKey} role={role} currentAgent={currentAgent}/>
  
  <div className="bg-white rounded-xl shadow-md p-6 flex flex-col justify-start gap-4">
  {role === 'admin' && (
    <>
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New Sale</h2>
        <AddSaleForm onSaleAdded={() => setRefreshKey(k => k + 1)} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New Agent</h2>
        <AddAgentForm onAgentAdded={() => setRefreshKey(k => k + 1)} />
      </div>
    </>
  )}
  {role === 'agent' && (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-400 text-sm">Read-only view</p>
    </div>
  )}
</div>
</div>

      {/* Sales Table */}
      <SalesTable role={role} refreshKey={refreshKey} currentAgent={currentAgent} onRefresh={() => setRefreshKey(k => k + 1)} />


    </main>
  )
}