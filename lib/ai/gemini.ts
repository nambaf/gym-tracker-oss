import { AIConfigError, type ProviderFn } from './types'

const DEFAULT_MODEL = 'gemini-2.5-flash'

export const geminiProvider: ProviderFn = async (prompt, opts) => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new AIConfigError('GEMINI_API_KEY not set')
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs)
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: opts.temperature,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: opts.maxTokens,
        },
      }),
    })

    if (!res.ok) {
      const err = new Error(`Gemini API error: ${res.status} ${res.statusText}`) as Error & { status?: number }
      err.status = res.status
      throw err
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Gemini: unexpected response shape')
    return text
  } finally {
    clearTimeout(t)
  }
}
