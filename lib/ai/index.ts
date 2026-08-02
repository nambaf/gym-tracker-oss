import 'server-only'
import { AIConfigError, AIDisabledError, isRetriable, type AIProvider, type GenerateOptions, type ProviderFn } from './types'
import { bedrockProvider } from './bedrock'
import { geminiProvider } from './gemini'
import { openaiProvider } from './openai'
import { anthropicProvider } from './anthropic'

export type { AIProvider, GenerateOptions } from './types'
export { AIDisabledError, AIConfigError } from './types'

const PROVIDERS: Record<Exclude<AIProvider, 'off'>, ProviderFn> = {
  bedrock: bedrockProvider,
  gemini: geminiProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
}

const VALID_PROVIDERS: AIProvider[] = ['bedrock', 'gemini', 'openai', 'anthropic', 'off']

const DEFAULT_OPTS: Required<GenerateOptions> = {
  maxTokens: 2048,
  temperature: 0.7,
  timeoutMs: 12000,
}

const MAX_ATTEMPTS = 3

function parseProvider(raw: string, varName: string): AIProvider {
  const value = raw.toLowerCase()
  if (!VALID_PROVIDERS.includes(value as AIProvider)) {
    throw new AIConfigError(`Invalid ${varName}: ${raw}`)
  }
  return value as AIProvider
}

function getProviderName(): AIProvider {
  return parseProvider(process.env.AI_PROVIDER || 'off', 'AI_PROVIDER')
}

/**
 * Provider to try when the primary one fails for a reason retrying won't fix —
 * a free-tier quota that has run out, a revoked key, a model the account can't
 * reach. Lets an adopter run a free provider by default and pay only for the
 * calls it can't serve.
 *
 * CUSTOMIZE: set AI_FALLBACK_PROVIDER to any value AI_PROVIDER accepts.
 * Leave unset (or 'off') for no fallback.
 */
function getFallbackProviderName(): AIProvider {
  return parseProvider(process.env.AI_FALLBACK_PROVIDER || 'off', 'AI_FALLBACK_PROVIDER')
}

export function isAIEnabled(): boolean {
  return getProviderName() !== 'off'
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Run one provider with the retry policy. Throws once its attempts are spent. */
async function callProvider(
  name: Exclude<AIProvider, 'off'>,
  prompt: string,
  opts: Required<GenerateOptions>,
): Promise<string> {
  const fn = PROVIDERS[name]
  let lastError: unknown = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn(prompt, opts)
    } catch (err) {
      lastError = err
      if (err instanceof AIConfigError) throw err
      if (!isRetriable(err) || attempt === MAX_ATTEMPTS - 1) break
      await sleep(400 * (attempt + 1))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('AI call failed')
}

export async function generateText(prompt: string, options?: GenerateOptions): Promise<string> {
  const name = getProviderName()
  if (name === 'off') throw new AIDisabledError()

  const opts: Required<GenerateOptions> = { ...DEFAULT_OPTS, ...options }

  try {
    return await callProvider(name, prompt, opts)
  } catch (primaryError) {
    const fallback = getFallbackProviderName()
    // A misconfigured fallback must not mask the real failure, and falling back
    // to the provider that just failed would only double the latency.
    if (fallback === 'off' || fallback === name) throw primaryError
    console.warn(
      `AI provider "${name}" failed, falling back to "${fallback}":`,
      primaryError instanceof Error ? primaryError.message : primaryError,
    )
    try {
      return await callProvider(fallback, prompt, opts)
    } catch (fallbackError) {
      console.error(`AI fallback "${fallback}" also failed:`,
        fallbackError instanceof Error ? fallbackError.message : fallbackError)
      // The primary is the one the adopter configured; report its failure.
      throw primaryError
    }
  }
}
