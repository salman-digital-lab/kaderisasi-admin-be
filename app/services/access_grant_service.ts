import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import { getAdminRole } from '#constants/admin_roles'

export type AdminAccess = { id: number; role_code: string | null; is_active: boolean }
export type AccessChange = { roleCode?: string | null; isActive?: boolean }

export function accessChangeError(
  current: AdminAccess,
  change: AccessChange,
  activeSuperAdmins: number
): string | null {
  if (change.roleCode !== undefined && change.roleCode !== null && !getAdminRole(change.roleCode)) {
    return 'UNKNOWN_ROLE'
  }
  if (
    current.is_active &&
    current.role_code === 'super_admin' &&
    (change.isActive === false ||
      (change.roleCode !== undefined && change.roleCode !== 'super_admin')) &&
    activeSuperAdmins <= 1
  )
    return 'LAST_SUPER_ADMIN_REQUIRED'
  return null
}

/** Caller holds the access advisory lock before changing any administrator's access. */
export async function changeAdminAccess(
  client: QueryClientContract,
  userId: number,
  change: AccessChange
): Promise<string | null> {
  const user = (await client.from('admin_users').where('id', userId).forUpdate().first()) as
    | AdminAccess
    | undefined
  if (!user) return 'USER_NOT_FOUND'
  const count = await client
    .from('admin_users')
    .where('role_code', 'super_admin')
    .where('is_active', true)
    .count('* as total')
    .first()
  const error = accessChangeError(user, change, Number(count?.total ?? 0))
  if (error) return error
  await client
    .from('admin_users')
    .where('id', userId)
    .update({
      ...(change.roleCode !== undefined ? { role_code: change.roleCode } : {}),
      ...(change.isActive !== undefined ? { is_active: change.isActive } : {}),
      updated_at: new Date(),
    })
  if (change.isActive === false) {
    await client
      .from('admin_refresh_tokens')
      .where('admin_user_id', userId)
      .whereNull('revoked_at')
      .update({ revoked_at: new Date(), revocation_reason: 'account_deactivated' })
  }
  return null
}
