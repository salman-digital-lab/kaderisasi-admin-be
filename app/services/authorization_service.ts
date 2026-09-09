import { getAdminRole, getRolePermissions } from '#constants/admin_roles'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import type { PermissionCode } from '#constants/permissions'

export type AssignedRole = {
  code: string
  name: string
}

export type AuthorizationSnapshot = {
  role: AssignedRole | null
  permissions: PermissionCode[]
  is_super_admin: boolean
}

const requestCache = new WeakMap<HttpContext, Map<number, AuthorizationSnapshot>>()

export function authorizationForRole(roleCode: string | null | undefined): AuthorizationSnapshot {
  const definition = getAdminRole(roleCode)
  return {
    role: definition ? { code: definition.code, name: definition.name } : null,
    permissions: getRolePermissions(roleCode),
    is_super_admin: definition?.code === 'super_admin',
  }
}

export async function resolveAuthorization(userId: number): Promise<AuthorizationSnapshot> {
  const user = await db
    .from('admin_users')
    .where('id', userId)
    .select('role_code', 'is_active')
    .first()
  return authorizationForRole(user?.is_active ? user.role_code : null)
}

export async function getAuthorization(
  ctx: HttpContext,
  userId: number,
  force = false
): Promise<AuthorizationSnapshot> {
  let cache = requestCache.get(ctx)
  if (!cache) {
    cache = new Map<number, AuthorizationSnapshot>()
    requestCache.set(ctx, cache)
  }

  if (!force && cache.has(userId)) {
    return cache.get(userId)!
  }

  const snapshot = await resolveAuthorization(userId)
  cache.set(userId, snapshot)
  ctx.authorization = snapshot
  return snapshot
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    authorization?: AuthorizationSnapshot
  }
}
