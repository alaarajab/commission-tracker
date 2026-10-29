'use client'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useState, useMemo, useRef, useEffect } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@/lib/chatTools'
import { authHeaders } from '@/lib/authFetch'

// What to show while each tool is running / after it finished
const TOOL_LABELS: Record<string, string> = {
  getAgentCommissions: 'commissions',
  getPendingSales: 'pending sales',
  getTopAgents: 'top agents',
  getSalesSummary: 'sales summary',
}

// Styles for the markdown the assistant writes (bold, lists, tables)
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2 last:mb-0">
      <table className="text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-gray-200 px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-gray-200 px-2 py-1">{children}</td>,
}

const SUGGESTIONS = [
  'Who are the top 3 agents?',
  'Show pending sales',
  'How much commission was earned this month?',
  'Give me a full summary',
]

function ToolStatus({ name, state }: { name: string; state: string }) {
  const label = TOOL_LABELS[name] ?? 'data'

  if (state === 'output-error') {
    return <div className="text-xs text-red-600">Couldn&apos;t load {label}</div>
  }

  const done = state === 'output-available'
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      {done ? (
        <span className="text-green-600">✓</span>
      ) : (
        <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      )}
      {done ? `Checked ${label}` : `Looking up ${label}…`}
    </div>
  )
}

export default function CommissionChat() {
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat', headers: authHeaders }), [])
  const { messages, sendMessage, status, error, setMessages, clearError } = useChat<ChatMessage>({ transport })
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Busy from the moment a question is sent until the answer finishes
  const busy = status === 'submitted' || status === 'streaming'

  // Show typing dots until the assistant has something visible to show
  const last = messages[messages.length - 1]
  const waitingForFirstPart =
    status === 'submitted' ||
    (status === 'streaming' &&
      (last?.role !== 'assistant' || !last.parts.some((p) => p.type === 'text' || p.type.startsWith('tool-'))))

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, status])

  const handleSend = (text: string) => {
    if (!text.trim() || busy) return
    clearError()
    sendMessage({ text })
    setInput('')
  }

  const startNewChat = () => {
    setMessages([])
    clearError()
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Chat window */}
      {open && (
        <div className="flex flex-col w-[380px] max-w-[calc(100vw-3rem)] h-[520px] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-white font-medium text-sm">Commission Assistant</span>
            </div>
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button
                  onClick={startNewChat}
                  disabled={busy}
                  className="text-white/80 hover:text-white text-xs disabled:opacity-40"
                >
                  New chat
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="text-white/70 hover:text-white text-lg leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 text-center">Ask me anything about commissions</p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="text-left text-xs border border-gray-200 bg-white rounded-lg px-3 py-2 hover:bg-blue-50 hover:border-blue-200 transition-colors text-gray-700"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              if (m.role === 'user') {
                const text = m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('')
                return (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm leading-relaxed bg-blue-600 text-white whitespace-pre-wrap">
                      {text}
                    </div>
                  </div>
                )
              }

              const toolParts = m.parts.filter((p) => p.type.startsWith('tool-'))
              const textParts = m.parts.filter((p) => p.type === 'text')
              if (toolParts.length === 0 && textParts.length === 0) return null

              return (
                <div key={m.id} className="flex flex-col items-start gap-1.5">
                  {toolParts.map((p, i) =>
                    'state' in p ? (
                      <ToolStatus key={i} name={p.type.replace(/^tool-/, '')} state={p.state ?? ''} />
                    ) : null
                  )}
                  {textParts.length > 0 && (
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed bg-white border border-gray-200 text-gray-800">
                      {textParts.map((p, i) =>
                        p.type === 'text' ? (
                          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={markdownComponents}>
                            {p.text}
                          </ReactMarkdown>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {waitingForFirstPart && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1 items-center h-4">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error.message || 'Something went wrong. Please try again.'}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            className="border-t border-gray-200 p-3 flex gap-2 bg-white"
            onSubmit={(e) => {
              e.preventDefault()
              handleSend(input)
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={busy ? 'Thinking…' : 'Ask about commissions...'}
              maxLength={500}
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm disabled:opacity-40 hover:bg-blue-700 transition-colors"
            >
              Send
            </button>
          </form>

        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105"
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

    </div>
  )
}
