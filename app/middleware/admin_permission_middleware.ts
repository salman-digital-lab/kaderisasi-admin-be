import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export type AdminPermission = 'akunadmin' | 'club' | 'formkustom'

const FULL_ACCESS = new Set<AdminPermission>(['akunadmin', 'club', 'formkustom'])
const CLUB_ACCESS = new Set<AdminPermission>(['club', 'formkustom'])

const ROLE_PERMISSIONS = new Map<number, Set<AdminPermission>>([
  [0, FULL_ACCESS],
  [1, CLUB_ACCESS],
  [2, CLUB_ACCESS],
  [3, CLUB_ACCESS],
])

export function hasAdminPermission(role: number | undefined, permission: AdminPermission): boolean {
  if (role === undefined) return false
  return ROLE_PERMISSIONS.get(role)?.has(permission) ?? false
}

export default class AdminPermissionMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { permission: AdminPermission }
  ): Promise<void> {
    const user = ctx.auth.user

    if (!user || !hasAdminPermission(user.role, options.permission)) {
      ctx.response.forbidden({ message: 'FORBIDDEN' })
      return
    }

    await next()
  }
}
