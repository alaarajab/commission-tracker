'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import StatCard from '@/components/StatCard'
import SalesTable from '@/components/SalesTable'
import CommissionChart from '@/components/CommissionChart'
import AddSaleForm from '@/components/AddSaleForm'
import { LayoutDashboard, LogOut } from 'lucide-react'
import AddAgentForm from '@/components/AddAgentForm'
import CommissionChat from '@/components/CommissionChat'
import { useAuth } from '@/components/AuthProvider'

export default function Dashboard() {
  const router = useRouter()
  const { loading, session, agent, signOut } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)

  // Not signed in? Go to the login page
  useEffect(() => {
    if (!loading && !session) router.replace('/login')
  }, [loading, session, router])

  if (loading || !session) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </main>
    )
  }

  // Signed in, but this login isn't linked to an agent row
  if (!agent) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-md p-6 max-w-sm text-center space-y-3">
          <p className="text-gray-800 font-medium">Your account isn&apos;t linked to an agent yet.</p>
          <p className="text-sm text-gray-500">Ask your admin to add you as an agent with {session.user.email}.</p>
          <button onClick={signOut} className="text-sm text-blue-600 hover:underline">
            Sign out
          </button>
        </div>
      </main>
    )
  }

  // Role and name come from the login, not from a toggle
  const role = agent.role
  const currentAgent = agent.name

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

        {/* Signed-in user */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-800">{agent.name}</p>
            <p className="text-xs text-gray-500">{session.user.email}</p>
          </div>
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}
          >
            {role === 'admin' ? 'Admin' : 'Agent'}
          </span>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            <LogOut size={16} />
            Sign out
          </button>
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
<CommissionChat />

    </main>
  )
}