import { openai } from '@ai-sdk/openai'
import {
  streamText,
  createUIMessageStreamResponse,
  stepCountIs,
  convertToModelMessages,
  safeValidateUIMessages,
} from 'ai'
import { checkChatRateLimit } from '@/lib/chatRateLimit'
import { chatTools, type ChatMessage } from '@/lib/chatTools'

// Cost caps for the public demo
const MAX_HISTORY_MESSAGES = 10 // only send the most recent messages to OpenAI
const MAX_MESSAGE_CHARS = 500 // longest question a visitor can send
const MAX_OUTPUT_TOKENS = 600 // longest answer the model can write
const MAX_HISTORY_CHARS = 40_000 // total size of the history sent in one request

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

  let body: { messages?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid request.', { status: 400 })
  }

  const recent = Array.isArray(body?.messages) ? body.messages.slice(-MAX_HISTORY_MESSAGES) : []
  if (recent.length === 0) {
    return new Response('No message provided.', { status: 400 })
  }

  // History now includes tool calls and results, so cap its total size too
  if (JSON.stringify(recent).length > MAX_HISTORY_CHARS) {
    return new Response('This conversation is too long. Please refresh the page to start a new one.', { status: 400 })
  }

  // Check the messages really have the shape useChat sends, and that any
  // tool inputs/results match our tool schemas
  const validated = await safeValidateUIMessages<ChatMessage>({ messages: recent, tools: chatTools })
  if (!validated.success) {
    return new Response('Invalid conversation data.', { status: 400 })
  }
  const messages = validated.data

  const lastMessage = messages[messages.length - 1]
  if (lastMessage.role !== 'user') {
    return new Response('Invalid request.', { status: 400 })
  }
  const lastText = lastMessage.parts
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('')
  if (lastText.length > MAX_MESSAGE_CHARS) {
    return new Response(`Please keep questions under ${MAX_MESSAGE_CHARS} characters.`, { status: 400 })
  }

  // Keep text AND tool calls/results, so follow-up questions
  // ("and the 4th one?") can use earlier answers
  const modelMessages = await convertToModelMessages(messages, {
    tools: chatTools,
    ignoreIncompleteToolCalls: true,
  })

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: buildSystemPrompt(),
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    tools: chatTools,
    onError: ({ error }) => {
      console.error('CHAT ERROR:', error)
    },
  })

  return createUIMessageStreamResponse({
    stream: result.toUIMessageStream(),
  })
}