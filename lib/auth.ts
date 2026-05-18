/**
 * Cognito-based session auth for the single owner user.
 *
 *  - Login flow:    USER_PASSWORD_AUTH on the Cognito UserPoolClient.
 *  - Session:       Cognito ID token stored in an HTTP-only cookie.
 *  - Verification:  aws-jwt-verify in the Next.js middleware (Edge runtime).
 *
 * Tokens are signed by Cognito (RSA-256, JWKS rotated automatically by the
 * verifier). We do NOT store the refresh token: cookie lifetime equals the
 * ID token lifetime configured on the User Pool Client (1h by default), and
 * the user re-logs in afterwards. This is acceptable for a single-user app.
 */

import { CognitoJwtVerifier } from 'aws-jwt-verify'

export const AUTH_COOKIE = 'gt_id_token'
// 5 hours — long enough to cover a full workout including warm-up,
// rest periods, and the post-session AI debrief. Must match
// `IdTokenValidity` on the Cognito UserPoolClient in `template.yaml`.
export const COOKIE_MAX_AGE = 60 * 60 * 5

function readConfig() {
  const userPoolId = process.env.COGNITO_USER_POOL_ID
  const clientId = process.env.COGNITO_CLIENT_ID
  if (!userPoolId || !clientId) {
    throw new Error('Cognito not configured: COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID required')
  }
  return { userPoolId, clientId }
}

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null

function getVerifier() {
  if (verifier) return verifier
  const { userPoolId, clientId } = readConfig()
  verifier = CognitoJwtVerifier.create({
    userPoolId,
    tokenUse: 'id',
    clientId,
  })
  return verifier
}

export async function verifyAuthToken(token: string | undefined): Promise<boolean> {
  if (!token) return false
  try {
    await getVerifier().verify(token)
    return true
  } catch {
    return false
  }
}

export function getCognitoConfig() {
  return readConfig()
}
