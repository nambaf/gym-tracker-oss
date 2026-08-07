/**
 * Credential resolution for the MCP server.
 *
 * Why not just let the AWS SDK resolve the SSO profile itself: on a proxied
 * network the SDK's SSO provider builds its own HTTP client to call the SSO
 * portal, and that client does not go through the proxy handler configured in
 * `ddb.ts` — so it hangs until timeout and reports a bare `TimeoutError` that
 * says nothing about the real problem. The AWS CLI honours HTTPS_PROXY on its
 * own and already owns the token cache and its refresh, so we ask it instead
 * and hand the result over as static credentials.
 *
 * It also removes a failure mode specific to Claude Desktop: a GUI-spawned
 * process inherits a minimal environment, where SSO resolution is more fragile
 * than in a terminal.
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import type { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@aws-sdk/types'

const execFileAsync = promisify(execFile)

/**
 * A GUI-launched process gets a minimal PATH (`/usr/bin:/bin:/usr/sbin:/sbin`),
 * which does not include Homebrew — where the CLI actually lives on macOS. So
 * the binary is located explicitly instead of trusting PATH.
 *
 * CUSTOMIZE: set AWS_CLI_PATH if your CLI lives somewhere else.
 */
function findAwsCli(): string {
  const candidates = [
    process.env.AWS_CLI_PATH,
    '/opt/homebrew/bin/aws',
    '/usr/local/bin/aws',
    '/usr/bin/aws',
  ].filter((p): p is string => !!p)
  return candidates.find(p => existsSync(p)) || 'aws'
}

async function fromAwsCli(): Promise<AwsCredentialIdentity> {
  const bin = findAwsCli()
  const args = ['configure', 'export-credentials', '--format', 'process']
  const profile = process.env.AWS_PROFILE
  if (profile) args.push('--profile', profile)

  let stdout: string
  try {
    ({ stdout } = await execFileAsync(bin, args, { timeout: 30_000 }))
  } catch (err: any) {
    const detail = String(err?.stderr || err?.message || err).trim()
    throw new Error(
      `Could not get AWS credentials from the CLI (${bin}).\n` +
      `${detail}\n\n` +
      `If the SSO session has expired, run:  aws sso login --profile ${profile || '<your-profile>'}`
    )
  }

  const parsed = JSON.parse(stdout)
  if (!parsed.AccessKeyId || !parsed.SecretAccessKey) {
    throw new Error(`Unexpected credential payload from ${bin}: missing AccessKeyId/SecretAccessKey.`)
  }
  return {
    accessKeyId: parsed.AccessKeyId,
    secretAccessKey: parsed.SecretAccessKey,
    sessionToken: parsed.SessionToken,
    // Returning the expiry lets the SDK re-invoke this provider on its own
    // once the SSO session rolls over, instead of failing mid-conversation.
    expiration: parsed.Expiration ? new Date(parsed.Expiration) : undefined,
  }
}

export const resolveCredentials: AwsCredentialIdentityProvider = async () => {
  // Explicit credentials in the environment win — useful for CI, for a
  // non-SSO profile, or for anyone who does not have the CLI installed.
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN } = process.env
  if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      sessionToken: AWS_SESSION_TOKEN,
    }
  }
  return fromAwsCli()
}
