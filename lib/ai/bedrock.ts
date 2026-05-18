import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { AIConfigError, type ProviderFn } from './types'

// Default Claude Haiku 4.5 on Bedrock (Anthropic-hosted Messages API format).
const DEFAULT_MODEL = 'anthropic.claude-haiku-4-5'

let client: BedrockRuntimeClient | null = null

function getClient(): BedrockRuntimeClient {
  if (client) return client
  // Bedrock region may differ from APP_AWS_REGION (Claude not available in eu-south-1).
  const region = process.env.BEDROCK_REGION || process.env.APP_AWS_REGION
  if (!region) throw new AIConfigError('BEDROCK_REGION not set')
  client = new BedrockRuntimeClient({ region })
  return client
}

export const bedrockProvider: ProviderFn = async (prompt, opts) => {
  const modelId = process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    messages: [{ role: 'user', content: prompt }],
  })

  const cmd = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(body),
  })

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs)
  try {
    const res = await getClient().send(cmd, { abortSignal: ctrl.signal })
    const json = JSON.parse(new TextDecoder().decode(res.body))
    const text = json?.content?.[0]?.text
    if (!text) throw new Error('Bedrock: unexpected response shape')
    return text
  } catch (err) {
    // Surface AWS SDK status on retriable errors.
    const e = err as { $metadata?: { httpStatusCode?: number }; name?: string }
    const status = e?.$metadata?.httpStatusCode
    if (status) (err as { status?: number }).status = status
    throw err
  } finally {
    clearTimeout(t)
  }
}
