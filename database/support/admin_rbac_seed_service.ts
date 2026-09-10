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
    await client.from('admin_users').where('id', user.id).update({
      role_code: 'super_admin',
      updated_at: now,
    })
  }
  const activeSuperAdmin = await client
    .from('admin_users')
    .where('role_code', 'super_admin')
    .where('is_active', true)
    .first()
  if (!activeSuperAdmin) throw new Error('ADMIN_BOOTSTRAP_EMAILS_REQUIRED')
}
