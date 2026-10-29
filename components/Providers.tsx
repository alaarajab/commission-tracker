'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/components/AuthProvider'

const queryClient = new QueryClient()

export default function Providers({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster position="top-right" />
    </QueryClientProvider>
  )
}