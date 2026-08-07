/**
 * Corporate-proxy support for the AWS SDK.
 *
 * `curl` honours HTTPS_PROXY on its own; Node's https module and the AWS SDK
 * do not. On a proxied network that difference is invisible until every AWS
 * call hangs until timeout while curl to the same host answers in 200 ms.
 *
 * Nothing here activates unless HTTPS_PROXY/HTTP_PROXY is actually set, so an
 * unproxied machine keeps the SDK's default handler.
 */
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { HttpsProxyAgent } from 'https-proxy-agent'

function proxyUrl(): string | undefined {
  return (
    process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.HTTP_PROXY || process.env.http_proxy ||
    undefined
  )
}

/** NO_PROXY is a comma-separated suffix list; a leading dot is optional. */
function isBypassed(hostname: string): boolean {
  const raw = process.env.NO_PROXY || process.env.no_proxy || ''
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
    .some(entry => {
      if (entry === '*') return true
      const suffix = entry.startsWith('.') ? entry : `.${entry}`
      return hostname === entry || hostname.endsWith(suffix)
    })
}

/**
 * A request handler routed through the proxy, or undefined when no proxy
 * applies — in which case the caller should leave the SDK default alone.
 */
export function proxyRequestHandler(endpointHostname: string): NodeHttpHandler | undefined {
  const url = proxyUrl()
  if (!url || isBypassed(endpointHostname.toLowerCase())) return undefined
  const agent = new HttpsProxyAgent(url)
  return new NodeHttpHandler({ httpsAgent: agent, httpAgent: agent as any })
}
