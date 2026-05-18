import { NextRequest, NextResponse } from 'next/server'
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AuthFlowType,
  ChallengeNameType,
} from '@aws-sdk/client-cognito-identity-provider'
import { AUTH_COOKIE, COOKIE_MAX_AGE, getCognitoConfig } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const region =
  process.env.APP_AWS_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  'eu-south-1'

const cognito = new CognitoIdentityProviderClient({ region })

type LoginBody = {
  email?: string
  password?: string
  newPassword?: string
  session?: string
}

export async function POST(req: NextRequest) {
  let cfg: { userPoolId: string; clientId: string }
  try {
    cfg = getCognitoConfig()
  } catch {
    return NextResponse.json({ error: 'auth_not_configured' }, { status: 500 })
  }

  let body: LoginBody = {}
  try { body = await req.json() } catch {}

  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''

  if (!email || !password) {
    return NextResponse.json({ error: 'missing_credentials' }, { status: 400 })
  }

  try {
    // Phase 1: USER_PASSWORD_AUTH
    const auth = await cognito.send(new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: cfg.clientId,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }))

    // Phase 2 (only at first login): NEW_PASSWORD_REQUIRED challenge
    if (auth.ChallengeName === ChallengeNameType.NEW_PASSWORD_REQUIRED) {
      if (!body.newPassword) {
        return NextResponse.json({
          challenge: 'NEW_PASSWORD_REQUIRED',
          session: auth.Session,
        }, { status: 200 })
      }
      if (!body.session) {
        return NextResponse.json({ error: 'missing_session' }, { status: 400 })
      }
      const challenge = await cognito.send(new RespondToAuthChallengeCommand({
        ClientId: cfg.clientId,
        ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
        Session: body.session,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: body.newPassword,
        },
      }))
      return finalize(challenge.AuthenticationResult?.IdToken)
    }

    return finalize(auth.AuthenticationResult?.IdToken)
  } catch (err: any) {
    const code = err?.name || ''
    if (code === 'NotAuthorizedException' || code === 'UserNotFoundException') {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
    }
    if (code === 'PasswordResetRequiredException') {
      return NextResponse.json({ error: 'password_reset_required' }, { status: 403 })
    }
    if (code === 'InvalidPasswordException') {
      return NextResponse.json({ error: 'invalid_new_password', message: err.message }, { status: 400 })
    }
    console.error('Cognito login error:', code, err?.message)
    return NextResponse.json({ error: 'login_failed' }, { status: 500 })
  }
}

function finalize(idToken: string | undefined) {
  if (!idToken) {
    return NextResponse.json({ error: 'no_token' }, { status: 500 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE, idToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
  return res
}
