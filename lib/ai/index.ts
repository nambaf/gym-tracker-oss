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

function getProviderName(): AIProvider {
  const raw = (process.env.AI_PROVIDER || 'off').toLowerCase()
  if (!VALID_PROVIDERS.includes(raw as AIProvider)) {
    throw new AIConfigError(`Invalid AI_PROVIDER: ${raw}`)
  }
  return raw as AIProvider
}

export function isAIEnabled(): boolean {
  return getProviderName() !== 'off'
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function generateText(prompt: string, options?: GenerateOptions): Promise<string> {
  const name = getProviderName()
  if (name === 'off') throw new AIDisabledError()

  const fn = PROVIDERS[name]
  const opts: Required<GenerateOptions> = { ...DEFAULT_OPTS, ...options }

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
