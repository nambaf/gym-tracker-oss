import { AIConfigError, type ProviderFn } from './types'

const DEFAULT_MODEL = 'gpt-4o-mini'

export const openaiProvider: ProviderFn = async (prompt, opts) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new AIConfigError('OPENAI_API_KEY not set')
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = new Error(`OpenAI API error: ${res.status} ${res.statusText}`) as Error & { status?: number }
      err.status = res.status
      throw err
    }

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('OpenAI: unexpected response shape')
    return text
  } finally {
    clearTimeout(t)
  }
}
