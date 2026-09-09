import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { permissionAbility } from '#abilities/main'
import type { PermissionCode } from '#constants/permissions'
import { getAuthorization } from '#services/authorization_service'

export default class PermissionMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { permission: PermissionCode }
  ): Promise<void> {
    const user = ctx.auth.user
    if (!user) {
      ctx.response.unauthorized({ message: 'UNAUTHORIZED' })
      return
    }

    const authorization = await getAuthorization(ctx, user.id)
    user.$extras.authorization = authorization
    const allowed = await ctx.bouncer.allows(permissionAbility, options.permission)

    if (!allowed) {
      ctx.response.forbidden({ message: 'FORBIDDEN', permission: options.permission })
      return
    }

    await next()
  }
}
