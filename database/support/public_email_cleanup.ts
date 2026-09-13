import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export const accountFingerprintSql = `SELECT
  (SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY id), '')) FROM public_users t) AS users,
  (SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY id), '')) FROM profiles t) AS profiles,
  (SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY id), '')) FROM activity_registrations t) AS registrations,
  (SELECT md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY id), '')) FROM legacy_members t) AS legacy`

interface PublicAccount {
  id: number
  email: string | null
}
interface ProfileData {
  id: number
  user_id: number
  [key: string]: unknown
}
interface Reference {
  table_name: string
  column_name: string
  schema_name: string
}

export interface EmailCleanupReport {
  duplicates: { keepId: number; deleteId: number; email: string }[]
  lowercaseCount: number
  transferredRegistrations: number
  blockers: string[]
  fingerprint: Record<string, string>
  applied: boolean
  discardedLegacyIds: string[]
}

export async function cleanupPublicEmails(
  trx: TransactionClientContract,
  apply: boolean,
  expected?: Record<string, string>,
  discardInvalidEmails = false
): Promise<EmailCleanupReport> {
  if (apply) {
    await trx.rawQuery("SET LOCAL lock_timeout='10s'")
    await trx.rawQuery(
      'LOCK TABLE public_users, profiles, activity_registrations, legacy_members IN SHARE ROW EXCLUSIVE MODE'
    )
  } else await trx.rawQuery('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
  await trx.rawQuery("SET LOCAL timezone='UTC'")
  const referenceResult =
    await trx.rawQuery(`SELECT t.relname AS table_name, n.nspname AS schema_name, a.attname AS column_name
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=ANY(c.conkey)
    WHERE c.contype='f' AND c.confrelid='public_users'::regclass`)
  const references: Reference[] = referenceResult.rows
  for (const ref of references) {
    for (const name of [ref.schema_name, ref.table_name, ref.column_name])
      if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Unsupported reference identifier')
    if (apply)
      await trx.rawQuery(
        `LOCK TABLE "${ref.schema_name}"."${ref.table_name}" IN SHARE ROW EXCLUSIVE MODE`
      )
  }
  const fingerprintResult = await trx.rawQuery(accountFingerprintSql)
  const report: EmailCleanupReport = {
    duplicates: [],
    lowercaseCount: 0,
    transferredRegistrations: 0,
    blockers: [],
    fingerprint: fingerprintResult.rows[0],
    applied: false,
    discardedLegacyIds: [],
  }
  if (
    apply &&
    (!expected ||
      Object.keys(report.fingerprint).some((key) => expected[key] !== report.fingerprint[key]))
  )
    throw new Error('Database changed since verified backup; take a fresh backup')
  const users: PublicAccount[] = await trx.from('public_users').select('id', 'email').orderBy('id')
  if (discardInvalidEmails) {
    const legacy: { id: string | number; email: string | null }[] = await trx
      .from('legacy_members')
      .select('id', 'email')
    report.discardedLegacyIds = legacy
      .filter((row) => {
        const email = row.email?.trim().toLowerCase()
        return email && (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      })
      .map((row) => String(row.id))
  }
  const groups = new Map<string, PublicAccount[]>()
  for (const user of users) {
    if (user.email === null) continue
    const email = user.email.trim().toLowerCase()
    if (!email) {
      report.blockers.push(`EMPTY_PUBLIC_EMAIL:${user.id}`)
      continue
    }
    if (user.email !== email) report.lowercaseCount++
    groups.set(email, [...(groups.get(email) || []), user])
  }
  for (const [email, group] of groups)
    for (const duplicate of group.slice(1))
      report.duplicates.push({ keepId: group[0].id, deleteId: duplicate.id, email })
  const profiles: ProfileData[] = await trx.from('profiles').select('*')
  const byUser = new Map<number, ProfileData[]>()
  for (const profile of profiles)
    byUser.set(profile.user_id, [...(byUser.get(profile.user_id) || []), profile])
  for (const pair of report.duplicates) {
    if ((byUser.get(pair.keepId)?.length || 0) > 1 || (byUser.get(pair.deleteId)?.length || 0) > 1)
      report.blockers.push(`MULTIPLE_PROFILES:${pair.deleteId}`)
    for (const ref of references) {
      const countResult = await trx.rawQuery(
        `SELECT count(*)::int AS total FROM "${ref.schema_name}"."${ref.table_name}" WHERE "${ref.column_name}"=?`,
        [pair.deleteId]
      )
      const count: number = countResult.rows[0].total
      if (ref.table_name === 'activity_registrations' && ref.column_name === 'user_id')
        report.transferredRegistrations += count
      else if (ref.table_name !== 'profiles' && count)
        report.blockers.push(`LINKED_RECORDS:${pair.deleteId}:${ref.table_name}:${count}`)
    }
    const overlaps = await trx.rawQuery(
      `SELECT activity_id FROM activity_registrations WHERE user_id IN (?,?) GROUP BY activity_id HAVING count(*)>1`,
      [pair.keepId, pair.deleteId]
    )
    if (overlaps.rows.length)
      report.blockers.push(`OVERLAPPING_ACTIVITY_REGISTRATIONS:${pair.deleteId}`)
  }
  const journalPresence = await trx.rawQuery(
    "SELECT to_regclass('legacy_member_migrations') IS NOT NULL AS present"
  )
  if (journalPresence.rows[0].present && report.duplicates.length) {
    const linked = await trx
      .from('legacy_member_migrations')
      .whereIn(
        'public_user_id',
        report.duplicates.map((pair) => pair.deleteId)
      )
      .first()
    if (linked) report.blockers.push('ALREADY_MIGRATED_DUPLICATE')
  }
  if (!apply || report.blockers.length) return report
  if (report.discardedLegacyIds.length)
    await trx.from('legacy_members').whereIn('id', report.discardedLegacyIds).delete()
  const jsonColumnsResult = await trx
    .from('information_schema.columns')
    .whereRaw('table_schema=current_schema()')
    .where('table_name', 'profiles')
    .whereIn('data_type', ['json', 'jsonb'])
    .select('column_name')
  const jsonColumns = new Set<string>(jsonColumnsResult.map((column) => column.column_name))
  for (const pair of report.duplicates) {
    const keeper = byUser.get(pair.keepId)?.[0]
    const duplicate = byUser.get(pair.deleteId)?.[0]
    if (duplicate && !keeper) {
      await trx.from('profiles').where('id', duplicate.id).update({ user_id: pair.keepId })
      duplicate.user_id = pair.keepId
      byUser.set(pair.keepId, [duplicate])
    } else if (duplicate && keeper) {
      const patch: Record<string, unknown> = {}
      for (const [field, value] of Object.entries(duplicate)) {
        if (['id', 'user_id', 'created_at', 'updated_at'].includes(field)) continue
        const current = keeper[field]
        if (
          current === null ||
          current === '' ||
          (Array.isArray(current) && current.length === 0) ||
          (jsonColumns.has(field) && JSON.stringify(current) === '{}')
        )
          patch[field] = value
        else if (field === 'badges' && Array.isArray(current) && Array.isArray(value))
          patch[field] = [...new Set([...current, ...value])]
      }
      Object.assign(keeper, patch)
      for (const field of jsonColumns)
        if (field in patch && patch[field] !== null) patch[field] = JSON.stringify(patch[field])
      if (Object.keys(patch).length) await trx.from('profiles').where('id', keeper.id).update(patch)
      await trx.from('profiles').where('id', duplicate.id).delete()
    }
    await trx
      .from('activity_registrations')
      .where('user_id', pair.deleteId)
      .update({ user_id: pair.keepId })
    await trx.from('public_users').where('id', pair.deleteId).delete()
  }
  await trx.rawQuery(
    'UPDATE public_users SET email=lower(trim(email)) WHERE email IS NOT NULL AND email<>lower(trim(email))'
  )
  const remaining = await trx.rawQuery(
    `SELECT count(*)::int AS total FROM public_users WHERE email<>lower(trim(email))`
  )
  if (remaining.rows[0].total !== 0) throw new Error('Email normalization failed')
  report.applied = true
  return report
}
