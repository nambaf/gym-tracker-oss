export type AIProvider = 'bedrock' | 'gemini' | 'openai' | 'anthropic' | 'off'

export type GenerateOptions = {
  maxTokens?: number
  temperature?: number
  /** Per-attempt timeout in ms. */
  timeoutMs?: number
}

export class AIDisabledError extends Error {
  constructor(message = 'Coach AI disabled (AI_PROVIDER=off)') {
    super(message)
    this.name = 'AIDisabledError'
  }
}

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AIConfigError'
  }
}

export type ProviderFn = (prompt: string, opts: Required<GenerateOptions>) => Promise<string>

/**
 * Soft-retry classifier: only network/5xx/rate-limit errors are retried.
 */
export function isRetriable(err: unknown): boolean {
  const e = err as { name?: string; status?: number }
  if (e?.name === 'AbortError') return true
  const s = e?.status
  if (typeof s === 'number' && (s === 429 || s >= 500)) return true
  return false
}
