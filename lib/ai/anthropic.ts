import { AIConfigError, type ProviderFn } from './types'

const DEFAULT_MODEL = 'claude-haiku-4-5'

export const anthropicProvider: ProviderFn = async (prompt, opts) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new AIConfigError('ANTHROPIC_API_KEY not set')
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
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
      const err = new Error(`Anthropic API error: ${res.status} ${res.statusText}`) as Error & { status?: number }
      err.status = res.status
      throw err
    }

    const data = await res.json()
    const text = data?.content?.[0]?.text
    if (!text) throw new Error('Anthropic: unexpected response shape')
    return text
  } finally {
    clearTimeout(t)
  }
}
