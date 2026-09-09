import { DateTime } from 'luxon'
import { OAuth2Client, type LoginTicket } from 'google-auth-library'
import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import AdminUser from '#models/admin_user'
import AdminAuthIdentity from '#models/admin_auth_identity'
import PublicUser from '#models/public_user'
import {
  editPublicUserValidator,
  googleLoginValidator,
  loginValidator,
} from '#validators/auth_validator'
import {
  issueSession,
  revokePresentedSession,
  rotateSession,
  sessionForAuthenticatedUser,
} from '#services/auth_session_service'

function sessionResponse(session: Awaited<ReturnType<typeof issueSession>>) {
  return {
    ...session,
    token: {
      type: 'bearer',
      token: session.access_token,
      expiresIn: '15m',
    },
  }
}

export default class AuthController {
  async login(ctx: HttpContext) {
    const { request, response } = ctx
    const payload = await request.validateUsing(loginValidator)
    const email = payload.email.trim().toLowerCase()
    const user = await AdminUser.query().where('normalized_email', email).first()

    if (!user) {
      return response.notFound({ message: 'USER_NOT_FOUND' })
    }
    if (!user.isActive) {
      return response.forbidden({ message: 'USER_INACTIVE' })
    }
    if (!user.password || !(await hash.verify(user.password, payload.password))) {
      return response.unauthorized({ message: 'WRONG_PASSWORD' })
    }

    const session = await issueSession(ctx, user)
    return response.ok({ message: 'LOGIN_SUCCESS', data: sessionResponse(session) })
  }

  async google(ctx: HttpContext) {
    const { request, response } = ctx
    const clientId = env.get('GOOGLE_CLIENT_ID')
    if (!clientId) {
      return response.serviceUnavailable({ message: 'GOOGLE_LOGIN_NOT_CONFIGURED' })
    }

    const { credential } = await request.validateUsing(googleLoginValidator)
    let ticket: LoginTicket
    try {
      ticket = await new OAuth2Client(clientId).verifyIdToken({
        idToken: credential,
        audience: clientId,
      })
    } catch {
      return response.unauthorized({ message: 'GOOGLE_CREDENTIAL_INVALID' })
    }
    const payload = ticket.getPayload()
    const email = payload?.email?.trim().toLowerCase()

    if (!payload?.sub || !email || payload.email_verified !== true) {
      return response.unauthorized({ message: 'GOOGLE_EMAIL_NOT_VERIFIED' })
    }

    const user = await db.transaction(async (trx) => {
      const existingIdentity = await AdminAuthIdentity.query({ client: trx })
        .where('provider', 'google')
        .where('provider_subject', payload.sub)
        .first()

      if (existingIdentity) {
        existingIdentity.useTransaction(trx)
        existingIdentity.email = email
        existingIdentity.lastUsedAt = DateTime.now()
        await existingIdentity.save()
        return AdminUser.query({ client: trx })
          .where('id', existingIdentity.adminUserId)
          .firstOrFail()
      }

      let linkedUser = await AdminUser.query({ client: trx })
        .where('normalized_email', email)
        .first()
      if (!linkedUser) {
        linkedUser = await AdminUser.create(
          {
            email,
            normalizedEmail: email,
            displayName: payload.name?.trim() || email.split('@')[0],
            roleCode: null,
            isActive: true,
          },
          { client: trx }
        )
      }

      await AdminAuthIdentity.create(
        {
          adminUserId: linkedUser.id,
          provider: 'google',
          providerSubject: payload.sub,
          email,
          lastUsedAt: DateTime.now(),
        },
        { client: trx }
      )
      return linkedUser
    })

    if (!user.isActive) {
      return response.forbidden({ message: 'USER_INACTIVE' })
    }

    const session = await issueSession(ctx, user)
    return response.ok({ message: 'LOGIN_SUCCESS', data: sessionResponse(session) })
  }

  async refresh(ctx: HttpContext) {
    const session = await rotateSession(ctx)
    if (!session) {
      return ctx.response.unauthorized({ message: 'REFRESH_TOKEN_INVALID' })
    }
    return ctx.response.ok({ message: 'SESSION_REFRESHED', data: sessionResponse(session) })
  }

  async migrate(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail() as AdminUser
    const session = await issueSession(ctx, user)
    return ctx.response.ok({ message: 'SESSION_MIGRATED', data: sessionResponse(session) })
  }

  async me(ctx: HttpContext) {
    const session = await sessionForAuthenticatedUser(ctx)
    return ctx.response.ok({ message: 'GET_SESSION_SUCCESS', data: sessionResponse(session) })
  }

  async updateMember({ params, request, response }: HttpContext) {
    const payload = await request.validateUsing(editPublicUserValidator)
    const user = await PublicUser.findBy('id', params.id)
    if (!user) {
      return response.notFound({ message: 'USER_NOT_FOUND' })
    }

    if (payload.email) {
      const existing = await PublicUser.findBy('email', payload.email)
      if (existing && existing.id !== Number(params.id)) {
        return response.conflict({ message: 'EMAIL_ALREADY_REGISTERED' })
      }
    }

    const updated = await user.merge(payload).save()
    return response.ok({ message: 'UPDATE_MEMBER_SUCCESS', data: updated })
  }

  async logout(ctx: HttpContext) {
    await revokePresentedSession(ctx)
    return ctx.response.ok({ message: 'LOGOUT_SUCCESS' })
  }
}
