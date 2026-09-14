import type { QueryClientContract } from '@adonisjs/lucid/types/database'

export function parseBootstrapEmails(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    ),
  ]
}

/** Run within a transaction. Bootstrap accounts receive Super Admin; other assignments are preserved. */
export async function seedAdminRbac(
  client: QueryClientContract,
  bootstrapEmails: readonly string[]
): Promise<void> {
  await client.rawQuery('SELECT pg_advisory_xact_lock(?, ?)', [7411, 1])
  const multiRole = await client
    .from('information_schema.columns')
    .whereRaw('table_schema = current_schema()')
    .where('table_name', 'admin_users')
    .where('column_name', 'additional_role_codes')
    .first()
  const now = new Date()
  for (const email of bootstrapEmails) {
    const user = await client.from('admin_users').where('normalized_email', email).first()
    if (!user) {
      await client.table('admin_users').insert({
        email,
        normalized_email: email,
        display_name: email.split('@')[0],
        password: null,
        role_code: 'super_admin',
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      continue
    }
    if (!user.is_active) throw new Error('BOOTSTRAP_ADMIN_IS_INACTIVE')
    if (multiRole) {
      const assigned: string[] = [user.role_code, ...user.additional_role_codes].filter(Boolean)
      if (!assigned.includes('super_admin')) assigned.push('super_admin')
      await client
        .from('admin_users')
        .where('id', user.id)
        .update({
          role_code: assigned[0],
          additional_role_codes: [...new Set(assigned.slice(1))],
          updated_at: now,
        })
      continue
    }
    await client.from('admin_users').where('id', user.id).update({
      role_code: 'super_admin',
      updated_at: now,
    })
  }
  const activeSuperAdmin = await client
    .from('admin_users')
    .where((query) => {
      query.where('role_code', 'super_admin')
      if (multiRole) query.orWhereRaw("'super_admin' = ANY(additional_role_codes)")
    })
    .where('is_active', true)
    .first()
  if (!activeSuperAdmin) throw new Error('ADMIN_BOOTSTRAP_EMAILS_REQUIRED')
}
