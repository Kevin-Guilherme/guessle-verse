import { createClient } from 'npm:@supabase/supabase-js@2'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

const PROMPTS: Record<string, Record<string, string>> = {
  complete: {
    js:     'Generate a short JavaScript code snippet (4-8 lines) where exactly one expression or value is replaced with `___`. The blank must be a single token or short phrase (e.g., a number, string, operator, method name). Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" }. The code must be syntactically valid when ___ is replaced with answer. Do not use comments. Keep it beginner-friendly.',
    ts:     'Generate a short TypeScript code snippet (4-8 lines) where exactly one expression or type annotation is replaced with `___`. Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" }. Valid when ___ is replaced with answer.',
    python: 'Generate a short Python code snippet (4-8 lines) where exactly one expression or value is replaced with `___`. Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" }. Valid when ___ is replaced with answer.',
  },
  fix: {
    js:     'Generate a short JavaScript code snippet (4-8 lines) that contains exactly one intentional bug (wrong operator, wrong method, off-by-one, etc.). Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" } where answer is the corrected fragment that replaces the bug (single token or short phrase). The code must have an obvious purpose.',
    ts:     'Generate a short TypeScript code snippet (4-8 lines) with exactly one intentional bug. Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" } where answer is the corrected fragment.',
    python: 'Generate a short Python code snippet (4-8 lines) with exactly one intentional bug. Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" } where answer is the corrected fragment.',
  },
  output: {
    js:     'Generate a short JavaScript code snippet (4-8 lines) that prints exactly one line to stdout via console.log(). Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" } where answer is the exact printed output (string, no newline). No user input. No external APIs.',
    ts:     'Generate a short TypeScript code snippet (4-8 lines) that prints exactly one line via console.log(). Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" } where answer is the exact printed output.',
    python: 'Generate a short Python code snippet (4-8 lines) that prints exactly one line via print(). Return JSON: { code: string, answer: string, explanation: string, difficulty: "easy"|"medium"|"hard" } where answer is the exact printed output.',
  },
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let language: 'js' | 'ts' | 'python'
  let modeVariant: 'complete' | 'fix' | 'output'
  try {
    const body = await req.json() as {
      language: 'js' | 'ts' | 'python'
      modeVariant: 'complete' | 'fix' | 'output'
    }
    language = body.language
    modeVariant = body.modeVariant
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  if (!language || !modeVariant) {
    return new Response(JSON.stringify({ error: 'language and modeVariant required' }), { status: 400 })
  }

  const prompt = PROMPTS[modeVariant]?.[language]
  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Invalid language or modeVariant' }), { status: 400 })
  }

  const groqKey = Deno.env.get('GROQ_API_KEY')
  if (!groqKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY not set' }), { status: 500 })
  }

  const groqRes = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:       'llama-3.3-70b-versatile',
      temperature: 0.7,
      messages: [
        {
          role:    'system',
          content: 'You are a programming puzzle generator. Always respond with valid JSON only. No markdown fences. No explanation outside the JSON object.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!groqRes.ok) {
    const errText = await groqRes.text()
    return new Response(JSON.stringify({ error: 'Groq error', detail: errText }), { status: 502 })
  }

  const groqData = await groqRes.json()
  const content  = groqData.choices?.[0]?.message?.content ?? ''

  let puzzle: { code: string; answer: string; explanation: string; difficulty: string }
  try {
    puzzle = JSON.parse(content)
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to parse Groq response', raw: content }), { status: 502 })
  }

  if (!puzzle.code || !puzzle.answer) {
    return new Response(JSON.stringify({ error: 'Incomplete puzzle', raw: content }), { status: 502 })
  }

  return new Response(JSON.stringify(puzzle), {
    headers: { 'Content-Type': 'application/json' },
  })
})
