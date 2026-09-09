import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import AdminUser from '#models/admin_user'
import { changeAdminAccess } from '#services/access_grant_service'
import { resolveAuthorization } from '#services/authorization_service'
import { revokeAllUserSessions } from '#services/auth_session_service'
import { editAdminUser, editPasswordValidator, registerValidator } from '#validators/auth_validator'

async function serializeAdminUser(user: AdminUser) {
  const [authorization, identities] = await Promise.all([
    resolveAuthorization(user.id),
    db
      .from('admin_auth_identities')
      .where('admin_user_id', user.id)
      .select('provider', 'email', 'last_used_at', 'created_at'),
  ])
  return {
    ...user.serialize(),
    role: authorization.role,
    effective_permissions: authorization.permissions,
    is_super_admin: authorization.is_super_admin,
    authentication_methods: [
      ...new Set([
        ...(user.password ? ['password'] : []),
        ...identities.map((item) => item.provider),
      ]),
    ],
    google_linked: identities.some((identity) => identity.provider === 'google'),
    identities,
  }
}

export default class AdminusersController {
  async index({ request, response }: HttpContext) {
    const page = Number(request.input('page', 1))
    const perPage = Math.min(Number(request.input('per_page', 10)), 100)
    const search = String(request.input('search', '')).trim().toLowerCase()
    const users = await AdminUser.query()
      .if(Boolean(search), (query) =>
        query.where((nested) =>
          nested.whereILike('email', `%${search}%`).orWhereILike('display_name', `%${search}%`)
        )
      )
      .orderBy('created_at', 'desc')
      .paginate(page, perPage)

    const serialized = await Promise.all(users.all().map(serializeAdminUser))
    return response.ok({
      message: 'GET_DATA_SUCCESS',
      data: { meta: users.getMeta(), data: serialized },
    })
  }

  async create(ctx: HttpContext) {
    const { request, response } = ctx
    const payload = await request.validateUsing(registerValidator)
    const email = payload.email.trim().toLowerCase()
    const existing = await AdminUser.query().where('normalized_email', email).first()
    if (existing) return response.conflict({ message: 'EMAIL_ALREADY_REGISTERED' })

    const user = await AdminUser.create({
      displayName: payload.displayName,
      email,
      normalizedEmail: email,
      password: payload.password,
      roleCode: payload.role_code ?? null,
      isActive: true,
    })
    return response.created({ message: 'REGISTER_SUCCESS', data: await serializeAdminUser(user) })
  }

  async show({ params, response }: HttpContext) {
    const user = await AdminUser.find(params.id)
    if (!user) return response.notFound({ message: 'USER_NOT_FOUND' })
    return response.ok({ message: 'GET_DATA_SUCCESS', data: await serializeAdminUser(user) })
  }

  async update(ctx: HttpContext) {
    const payload = await ctx.request.validateUsing(editAdminUser)
    const actor = ctx.auth.getUserOrFail()
    if (payload.isActive === false && actor.id === Number(ctx.params.id)) {
      return ctx.response.conflict({ message: 'SELF_DEACTIVATION_NOT_ALLOWED' })
    }
    const error = await db.transaction(async (trx) => {
      await trx.rawQuery('SELECT pg_advisory_xact_lock(?, ?)', [7411, 1])
      const currentActor = await trx.from('admin_users').where('id', actor.id).first()
      if (!currentActor?.is_active || currentActor.role_code !== 'super_admin')
        return 'SUPER_ADMIN_REQUIRED'
      return changeAdminAccess(trx, Number(ctx.params.id), {
        roleCode: payload.role_code,
        isActive: payload.isActive,
      })
    })
    if (error === 'SUPER_ADMIN_REQUIRED') return ctx.response.forbidden({ message: error })
    if (error === 'USER_NOT_FOUND') return ctx.response.notFound({ message: error })
    if (error) return ctx.response.conflict({ message: error })
    const user = await AdminUser.findOrFail(ctx.params.id)
    return ctx.response.ok({ message: 'UPDATE_DATA_SUCCESS', data: await serializeAdminUser(user) })
  }

  async editPassword({ params, request, response }: HttpContext) {
    const { password } = await request.validateUsing(editPasswordValidator)
    const user = await AdminUser.find(params.id)
    if (!user) return response.notFound({ message: 'USER_NOT_FOUND' })
    user.password = password
    await user.save()
    await revokeAllUserSessions(user.id, 'password_reset')
    return response.ok({ message: 'RESET_PASSWORD_SUCCESS' })
  }
}
