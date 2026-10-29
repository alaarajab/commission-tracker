import { openai } from '@ai-sdk/openai'
import { streamText, createUIMessageStreamResponse, stepCountIs } from 'ai'
import { checkChatRateLimit } from '@/lib/chatRateLimit'
import { chatTools } from '@/lib/chatTools'

// Cost caps for the public demo
const MAX_HISTORY_MESSAGES = 10 // only send the most recent messages to OpenAI
const MAX_MESSAGE_CHARS = 500 // longest question a visitor can send
const MAX_OUTPUT_TOKENS = 600 // longest answer the model can write

function buildSystemPrompt() {
  const now = new Date()
  const today = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return `You are a commission analytics assistant for a real estate sales team.
Agents are real estate sales reps. Sales are property sales. Each sale earns a 3% commission.

Data rules:
- Always use the tools to get numbers. Never make up or estimate figures.
- A commission is "paid" once the admin marks the sale paid; otherwise it is "pending". When reporting commissions, give both paid and pending amounts.
- Sale statuses: "pending" = waiting for approval, "approved" = approved but not paid yet, "paid" = commission paid out.

Time periods:
- Today is ${today}.
- Tools take a "period". Use "all_time" unless the user mentions a time period. "How much commission does X have?" and "Who are the top agents?" are all_time.
- "This month" → period "this_month". "Last month" → "last_month". "This year" → "this_year". A named month like "in September" → period "month", month 9.
- Time filters apply to the sale date.
- If a tool result includes allTimeTotals and the period amounts are $0, also tell the user the all-time amounts.

Agents:
- If a tool says several agents match a name, list them and ask which one the user means.
- If a tool says no agent was found, say so. Do not guess another agent.
- If the user says "my" or "I" without giving a name, ask for their agent name.

Style: concise and friendly. Format money as USD with commas, e.g. $18,000.`
}

export async function POST(req: Request) {
  const limit = await checkChatRateLimit(req)
  if (!limit.allowed) {
    return new Response(limit.message, { status: 429 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid request.', { status: 400 })
  }

  const messages = Array.isArray(body?.messages) ? body.messages.slice(-MAX_HISTORY_MESSAGES) : []
  if (messages.length === 0) {
    return new Response('No message provided.', { status: 400 })
  }

  const lastMessage = messages[messages.length - 1]
  const lastText = (lastMessage?.parts ?? [])
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('')
  if (lastText.length > MAX_MESSAGE_CHARS) {
    return new Response(`Please keep questions under ${MAX_MESSAGE_CHARS} characters.`, { status: 400 })
  }

  const modelMessages = messages.map((m: any) => ({
    role: m.role,
    content: m.parts
      ?.filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('') ?? '',
  }))

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: buildSystemPrompt(),
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    tools: chatTools,
    // Temporary debug logging: shows each step the bot takes
    
    onError: ({ error }) => {
      console.error('CHAT ERROR:', error)
    },
  })

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream(),
  })
}