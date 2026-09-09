import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import AdminUser from '#models/admin_user'
import AdminRefreshToken from '#models/admin_refresh_token'
import { resolveAuthorization } from '#services/authorization_service'

const REFRESH_COOKIE = 'admin_refresh_token'
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const REFRESH_TOKEN_TTL_DAYS = 30

export type AuthSession = Awaited<ReturnType<typeof buildAuthSession>>

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.get('NODE_ENV') === 'production',
    sameSite: 'lax' as const,
    path: '/v2/auth',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  }
}

export function readRefreshToken(ctx: HttpContext): string | undefined {
  return ctx.request.cookie(REFRESH_COOKIE)
}

export function clearRefreshCookie(ctx: HttpContext): void {
  ctx.response.clearCookie(REFRESH_COOKIE, refreshCookieOptions())
}

async function buildAuthSession(ctx: HttpContext, user: AdminUser) {
  const generated = await ctx.auth.use('jwt').generate(user)
  if (!('token' in generated)) {
    throw new Error('ACCESS_TOKEN_GENERATION_FAILED')
  }

  const authorization = await resolveAuthorization(user.id)
  const identities = await db
    .from('admin_auth_identities')
    .where('admin_user_id', user.id)
    .select('provider')
  const authenticationMethods = [
    ...(user.password ? ['password'] : []),
    ...identities.map((identity) => identity.provider as string),
  ]

  return {
    access_token: generated.token,
    access_token_expires_in: ACCESS_TOKEN_TTL_SECONDS,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      is_active: user.isActive,
      role: authorization.role,
    },
    authentication_methods: [...new Set(authenticationMethods)],
    permissions: authorization.permissions,
    is_super_admin: authorization.is_super_admin,
  }
}

async function createRefreshToken(
  ctx: HttpContext,
  user: AdminUser,
  options: { familyId?: string; parentTokenId?: number } = {}
): Promise<{ value: string; record: AdminRefreshToken }> {
  const value = randomBytes(48).toString('base64url')
  const record = await AdminRefreshToken.create({
    familyId: options.familyId ?? randomUUID(),
    adminUserId: user.id,
    tokenHash: hashToken(value),
    parentTokenId: options.parentTokenId ?? null,
    replacedByTokenId: null,
    userAgent: ctx.request.header('user-agent')?.slice(0, 500) ?? null,
    ipAddress: ctx.request.ip(),
    expiresAt: DateTime.now().plus({ days: REFRESH_TOKEN_TTL_DAYS }),
    lastUsedAt: null,
    revokedAt: null,
    revocationReason: null,
  })
  return { value, record }
}

export async function issueSession(ctx: HttpContext, user: AdminUser): Promise<AuthSession> {
  const refresh = await createRefreshToken(ctx, user)
  ctx.response.cookie(REFRESH_COOKIE, refresh.value, refreshCookieOptions())
  return buildAuthSession(ctx, user)
}

export async function rotateSession(ctx: HttpContext): Promise<AuthSession | null> {
  const value = readRefreshToken(ctx)
  if (!value) return null

  const rotated = await db.transaction(async (trx) => {
    const current = await AdminRefreshToken.query({ client: trx })
      .where('token_hash', hashToken(value))
      .forUpdate()
      .first()

    if (!current) return null

    if (current.revokedAt || current.expiresAt <= DateTime.now()) {
      await AdminRefreshToken.query({ client: trx })
        .where('family_id', current.familyId)
        .whereNull('revoked_at')
        .update({
          revoked_at: DateTime.now().toSQL(),
          revocation_reason: 'refresh_token_reuse',
        })
      return null
    }

    const user = await AdminUser.query({ client: trx }).where('id', current.adminUserId).first()
    if (!user || !user.isActive) {
      current.useTransaction(trx)
      current.revokedAt = DateTime.now()
      current.revocationReason = 'account_inactive'
      await current.save()
      return null
    }

    const nextValue = randomBytes(48).toString('base64url')
    const next = await AdminRefreshToken.create(
      {
        familyId: current.familyId,
        adminUserId: user.id,
        tokenHash: hashToken(nextValue),
        parentTokenId: current.id,
        replacedByTokenId: null,
        userAgent: ctx.request.header('user-agent')?.slice(0, 500) ?? null,
        ipAddress: ctx.request.ip(),
        expiresAt: DateTime.now().plus({ days: REFRESH_TOKEN_TTL_DAYS }),
        lastUsedAt: null,
        revokedAt: null,
        revocationReason: null,
      },
      { client: trx }
    )

    current.useTransaction(trx)
    current.lastUsedAt = DateTime.now()
    current.revokedAt = DateTime.now()
    current.revocationReason = 'rotated'
    current.replacedByTokenId = next.id
    await current.save()

    return { user, value: nextValue }
  })

  if (!rotated) return null
  ctx.response.cookie(REFRESH_COOKIE, rotated.value, refreshCookieOptions())
  return buildAuthSession(ctx, rotated.user)
}

export async function revokePresentedSession(ctx: HttpContext, reason = 'logout'): Promise<void> {
  const value = readRefreshToken(ctx)
  if (value) {
    await AdminRefreshToken.query()
      .where('token_hash', hashToken(value))
      .whereNull('revoked_at')
      .update({
        revoked_at: DateTime.now().toSQL(),
        revocation_reason: reason,
      })
  }
  clearRefreshCookie(ctx)
}

export async function revokeAllUserSessions(userId: number, reason: string): Promise<void> {
  await AdminRefreshToken.query().where('admin_user_id', userId).whereNull('revoked_at').update({
    revoked_at: DateTime.now().toSQL(),
    revocation_reason: reason,
  })
}

export async function sessionForAuthenticatedUser(ctx: HttpContext): Promise<AuthSession> {
  const user = ctx.auth.getUserOrFail() as AdminUser
  return buildAuthSession(ctx, user)
}
