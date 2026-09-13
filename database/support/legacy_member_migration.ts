import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { isDeepStrictEqual } from 'node:util'

export interface LegacySource {
  id: string
  name: string | null
  gender: string | null
  email: string | null
  phone: string | null
  line_id: string | null
  intake_year: string | null
  ssc: number | null
  lmd: number | null
  spectra: number | null
}

interface LegacyRow extends LegacySource {
  source_digest: string
}

interface UserRow {
  id: number
  email: string | null
  member_id: string | null
  account_status: string
}

type ProfileValues = {
  name: string | null
  gender: string | null
  whatsapp: string | null
  line: string | null
  intake_year: number | null
  level: number | null
  badges: string[]
}

interface ProfileRow extends ProfileValues {
  id: number
  user_id: number
}

export interface Resolution {
  publicUserId?: number
  fields?: Partial<Omit<LegacySource, 'id'>>
}

export interface Resolutions {
  members: Record<string, Resolution>
}

export interface MigrationReport {
  mode: 'dry-run' | 'apply'
  sourceCount: number
  alreadyMigrated: number
  createUsers: number
  mergeUsers: number
  blockers: { legacyId: string; reason: string; candidates?: UserRow[] }[]
  conflicts: {
    legacyId: string
    userId: number
    field: string
    current: unknown
    legacy: unknown
  }[]
  sources: LegacySource[]
  destinations: { legacyId: string; userId: number; profileId: number }[]
}

export const sourceSql = `SELECT id::text, name, gender, email, phone, line_id, intake_year,
  ssc, lmd, spectra, md5(to_jsonb(l)::text) AS source_digest FROM legacy_members l ORDER BY id`

export function normalizeEmail(value: string | null): string | null {
  return value?.trim().toLowerCase() || null
}

function normalizeBadges(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return []
  if (typeof value === 'string') {
    try {
      return normalizeBadges(JSON.parse(value))
    } catch {
      return [value]
    }
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw new Error('INVALID_EXISTING_BADGES')
  return value
}

export function profileValues(source: LegacySource): ProfileValues {
  const year = source.intake_year?.trim()
  const intakeYear = year ? Number(year) : null
  if (
    year &&
    (!/^\d+(?:\.0+)?$/.test(year) ||
      !Number.isInteger(intakeYear) ||
      intakeYear! < 1900 ||
      intakeYear! > 2100)
  ) {
    throw new Error('INVALID_INTAKE_YEAR')
  }
  for (const field of ['ssc', 'lmd', 'spectra'] as const) {
    if (source[field] !== null && (!Number.isFinite(source[field]) || source[field]! < 0)) {
      throw new Error(`INVALID_${field.toUpperCase()}`)
    }
  }
  for (const [field, limit] of [
    ['name', 255],
    ['gender', 1],
    ['phone', 35],
    ['line_id', 50],
  ] as const) {
    if (
      source[field] !== null &&
      (typeof source[field] !== 'string' || [...source[field]!].length > limit)
    ) {
      throw new Error(`INVALID_${field.toUpperCase()}`)
    }
  }
  if (!source.name?.trim()) throw new Error('MISSING_NAME')
  const email = normalizeEmail(source.email)
  if (email && (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
    throw new Error('INVALID_EMAIL')
  const badges: string[] = []
  if (source.ssc !== null) badges.push(`SSC-${source.ssc}`)
  if (source.lmd !== null) badges.push(`LMD-${source.lmd}`)
  if (source.spectra !== null) badges.push(`SPECTRA-${source.spectra}`)
  return {
    name: source.name,
    gender: source.gender,
    whatsapp: source.phone,
    line: source.line_id,
    intake_year: intakeYear,
    level: source.ssc !== null ? (source.lmd !== null ? (source.spectra !== null ? 10 : 6) : 3) : 0,
    badges,
  }
}

export function parseResolutions(value: unknown): Resolutions {
  if (
    !value ||
    typeof value !== 'object' ||
    !('members' in value) ||
    !value.members ||
    typeof value.members !== 'object' ||
    Array.isArray(value.members)
  ) {
    throw new Error('Resolutions must contain a members object keyed by legacy ID')
  }
  const allowed = new Set([
    'name',
    'gender',
    'email',
    'phone',
    'line_id',
    'intake_year',
    'ssc',
    'lmd',
    'spectra',
  ])
  for (const [id, entry] of Object.entries(value.members)) {
    if (!/^\d+$/.test(id) || !entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new Error('Invalid member resolution')
    for (const key of Object.keys(entry))
      if (!['publicUserId', 'fields'].includes(key))
        throw new Error(`Unknown resolution key: ${key}`)
    if (
      entry.publicUserId !== undefined &&
      (!Number.isSafeInteger(entry.publicUserId) || entry.publicUserId <= 0)
    )
      throw new Error('Invalid publicUserId')
    if (entry.fields !== undefined) {
      if (!entry.fields || typeof entry.fields !== 'object' || Array.isArray(entry.fields))
        throw new Error('Invalid resolution fields')
      for (const [field, fieldValue] of Object.entries(entry.fields)) {
        if (
          !allowed.has(field) ||
          (fieldValue !== null &&
            (['ssc', 'lmd', 'spectra'].includes(field)
              ? typeof fieldValue !== 'number'
              : typeof fieldValue !== 'string'))
        )
          throw new Error(`Invalid resolution field: ${field}`)
      }
    }
  }
  return value as Resolutions
}

export async function migrateLegacyMembers(
  trx: TransactionClientContract,
  apply: boolean,
  resolutions: Resolutions
): Promise<MigrationReport> {
  if (apply) {
    await trx.rawQuery("SET LOCAL lock_timeout = '10s'")
    await trx.rawQuery("SELECT pg_advisory_xact_lock(hashtext('legacy-member-migration'))")
    await trx.rawQuery(
      'LOCK TABLE legacy_members, public_users, profiles, legacy_member_migrations IN SHARE ROW EXCLUSIVE MODE'
    )
  } else {
    await trx.rawQuery('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
  }
  const sourceResult = await trx.rawQuery(sourceSql)
  const sources: LegacyRow[] = sourceResult.rows
  const users: UserRow[] = await trx
    .from('public_users')
    .select('id', 'email', 'member_id', 'account_status')
  const profiles: ProfileRow[] = await trx
    .from('profiles')
    .select('id', 'user_id', 'name', 'gender', 'whatsapp', 'line', 'intake_year', 'level', 'badges')
  const mappingPresence = await trx.rawQuery(
    "SELECT to_regclass('legacy_member_migrations') IS NOT NULL AS present"
  )
  const mappingExists = mappingPresence.rows[0].present
  const mappingResult = mappingExists
    ? await trx.rawQuery(`SELECT m.*, CASE WHEN u.id IS NOT NULL AND p.id IS NOT NULL
        THEN md5((to_jsonb(u) || jsonb_build_object('profile', to_jsonb(p)))::text) END AS actual_target_digest
        FROM legacy_member_migrations m LEFT JOIN public_users u ON u.id=m.public_user_id
        LEFT JOIN profiles p ON p.id=m.profile_id AND p.user_id=u.id`)
    : { rows: [] }
  const mappings: {
    legacy_id: string
    public_user_id: number
    profile_id: number
    source_digest: string
    target_digest: string
    actual_target_digest: string | null
    resolution: Resolution
  }[] = mappingResult.rows
  const mappingsById = new Map(mappings.map((m) => [String(m.legacy_id), m]))
  const usersByEmail = new Map<string, UserRow[]>()
  for (const user of users) {
    const email = normalizeEmail(user.email)
    if (email) usersByEmail.set(email, [...(usersByEmail.get(email) || []), user])
  }
  const profilesByUser = new Map<number, ProfileRow[]>()
  for (const profile of profiles)
    profilesByUser.set(profile.user_id, [...(profilesByUser.get(profile.user_id) || []), profile])
  const report: MigrationReport = {
    mode: apply ? 'apply' : 'dry-run',
    sourceCount: sources.length,
    alreadyMigrated: 0,
    createUsers: 0,
    mergeUsers: 0,
    blockers: [],
    conflicts: [],
    sources: [],
    destinations: [],
  }
  const plans: {
    source: LegacyRow
    original: LegacySource
    user?: UserRow
    profile?: ProfileRow
    values: ProfileValues
    resolution: Resolution
  }[] = []
  const sourceIds = new Set(sources.map((s) => s.id))
  for (const mapping of mappings) {
    if (!sourceIds.has(String(mapping.legacy_id)))
      report.blockers.push({ legacyId: String(mapping.legacy_id), reason: 'MAPPED_SOURCE_MISSING' })
  }
  for (const id of Object.keys(resolutions.members))
    if (!sourceIds.has(id))
      report.blockers.push({ legacyId: id, reason: 'UNKNOWN_RESOLUTION_SOURCE' })
  const selectedEmails = new Set<string>()
  const selectedUsers = new Set<number>()
  for (const row of sources) {
    const { source_digest: ignored, ...original } = row
    void ignored
    report.sources.push(original)
    const resolution = resolutions.members[row.id] || {}
    const source = { ...row, ...resolution.fields }
    const mapped = mappingsById.get(row.id)
    if (mapped) {
      if (
        mapped.source_digest !== row.source_digest ||
        mapped.actual_target_digest !== mapped.target_digest ||
        (resolutions.members[row.id] && !isDeepStrictEqual(mapped.resolution, resolution))
      ) {
        report.blockers.push({ legacyId: row.id, reason: 'MIGRATED_ROW_CHANGED' })
      } else {
        report.alreadyMigrated++
        report.destinations.push({
          legacyId: row.id,
          userId: mapped.public_user_id,
          profileId: mapped.profile_id,
        })
        selectedUsers.add(mapped.public_user_id)
      }
      continue
    }
    let values: ProfileValues
    try {
      values = profileValues(source)
    } catch (error) {
      report.blockers.push({ legacyId: row.id, reason: (error as Error).message })
      continue
    }
    const email = normalizeEmail(source.email)
    if (email && selectedEmails.has(email)) {
      report.blockers.push({ legacyId: row.id, reason: 'DUPLICATE_SOURCE_EMAIL' })
      continue
    }
    if (email) selectedEmails.add(email)
    const candidates = email ? usersByEmail.get(email) || [] : []
    const user = resolution.publicUserId
      ? candidates.find((u) => u.id === resolution.publicUserId)
      : candidates.length === 1
        ? candidates[0]
        : undefined
    if ((resolution.publicUserId && !user) || (candidates.length > 1 && !user)) {
      report.blockers.push({
        legacyId: row.id,
        reason: 'AMBIGUOUS_OR_INVALID_ACCOUNT_MATCH',
        candidates,
      })
      continue
    }
    if (user && selectedUsers.has(user.id)) {
      report.blockers.push({ legacyId: row.id, reason: 'DUPLICATE_DESTINATION' })
      continue
    }
    if (user) selectedUsers.add(user.id)
    const matches = user ? profilesByUser.get(user.id) || [] : []
    if (matches.length > 1) {
      report.blockers.push({ legacyId: row.id, reason: 'MULTIPLE_PUBLIC_PROFILES' })
      continue
    }
    const profile = matches[0]
    if (profile) {
      let currentBadges: string[]
      try {
        currentBadges = normalizeBadges(profile.badges)
      } catch {
        report.blockers.push({ legacyId: row.id, reason: 'INVALID_EXISTING_BADGES' })
        continue
      }
      for (const field of ['name', 'gender', 'whatsapp', 'line', 'intake_year', 'level'] as const) {
        const current = profile[field]
        if (
          current !== null &&
          current !== undefined &&
          !(typeof current === 'string' && current.trim() === '')
        ) {
          if (values[field] !== null && values[field] !== current)
            report.conflicts.push({
              legacyId: row.id,
              userId: user!.id,
              field,
              current,
              legacy: values[field],
            })
          Object.assign(values, { [field]: current })
        }
      }
      values.badges = [...new Set([...currentBadges, ...values.badges])]
    }
    if (user) report.mergeUsers++
    else report.createUsers++
    plans.push({ source, original, user, profile, values, resolution })
  }
  if (!apply || report.blockers.length) return report
  for (let offset = 0; offset < plans.length; offset += 500) {
    const batch = plans.slice(offset, offset + 500)
    const userIdsResult = await trx.rawQuery(
      "SELECT nextval(pg_get_serial_sequence('public_users', 'id'))::int AS id FROM generate_series(1, ?)",
      [batch.filter((plan) => !plan.user).length]
    )
    const profileIdsResult = await trx.rawQuery(
      "SELECT nextval(pg_get_serial_sequence('profiles', 'id'))::int AS id FROM generate_series(1, ?)",
      [batch.filter((plan) => !plan.profile).length]
    )
    const userIds: number[] = userIdsResult.rows.map((row: { id: number }) => row.id)
    const profileIds: number[] = profileIdsResult.rows.map((row: { id: number }) => row.id)
    const assigned = batch.map((plan) => ({
      ...plan,
      userId: plan.user?.id ?? userIds.shift()!,
      profileId: plan.profile?.id ?? profileIds.shift()!,
    }))
    const newUsers = assigned
      .filter((plan) => !plan.user)
      .map((plan) => {
        if (!Number.isSafeInteger(plan.userId) || plan.userId < 1 || plan.userId > 99_999_999)
          throw new Error('Member ID is outside eight-digit capacity')
        const email = normalizeEmail(plan.source.email)
        return {
          id: plan.userId,
          email,
          password: null,
          member_id: String(plan.userId).padStart(8, '0'),
          account_status: email ? 'active' : 'no_account',
          created_at: new Date(),
          updated_at: new Date(),
        }
      })
    if (newUsers.length) await trx.table('public_users').insert(newUsers)
    const newProfiles = assigned
      .filter((plan) => !plan.profile)
      .map((plan) => ({
        ...plan.values,
        id: plan.profileId,
        user_id: plan.userId,
        badges: JSON.stringify(plan.values.badges),
        created_at: new Date(),
        updated_at: new Date(),
      }))
    if (newProfiles.length) await trx.table('profiles').insert(newProfiles)
    const updates = assigned
      .filter((plan) => plan.profile)
      .map((plan) => ({ ...plan.values, id: plan.profileId }))
    if (updates.length)
      await trx.rawQuery(
        `UPDATE profiles p SET name=d.name, gender=d.gender, whatsapp=d.whatsapp,
      line=d.line, intake_year=d.intake_year, level=d.level, badges=d.badges, updated_at=now()
      FROM jsonb_to_recordset(?::jsonb) AS d(id int, name text, gender text, whatsapp text, line text, intake_year int, level int, badges jsonb)
      WHERE p.id=d.id`,
        [JSON.stringify(updates)]
      )
    const journal = assigned.map((plan) => ({
      legacy_id: plan.source.id,
      public_user_id: plan.userId,
      profile_id: plan.profileId,
      source_digest: plan.source.source_digest,
      source_data: plan.original,
      resolution: plan.resolution,
    }))
    await trx.rawQuery(
      `INSERT INTO legacy_member_migrations(legacy_id,public_user_id,profile_id,source_digest,target_digest,source_data,resolution)
      SELECT d.legacy_id,d.public_user_id,d.profile_id,d.source_digest,
        md5((to_jsonb(u) || jsonb_build_object('profile', to_jsonb(p)))::text),d.source_data,d.resolution
      FROM jsonb_to_recordset(?::jsonb) AS d(legacy_id bigint, public_user_id int, profile_id int, source_digest text, source_data jsonb, resolution jsonb)
      JOIN public_users u ON u.id=d.public_user_id JOIN profiles p ON p.id=d.profile_id AND p.user_id=u.id`,
      [JSON.stringify(journal)]
    )
    for (const plan of assigned)
      report.destinations.push({
        legacyId: plan.source.id,
        userId: plan.userId,
        profileId: plan.profileId,
      })
  }
  const reconciliation = await trx.rawQuery(`SELECT count(*)::int AS total FROM legacy_members l
    JOIN legacy_member_migrations m ON m.legacy_id=l.id AND m.source_digest=md5(to_jsonb(l)::text)
    JOIN public_users u ON u.id=m.public_user_id
    JOIN profiles p ON p.id=m.profile_id AND p.user_id=u.id
    WHERE m.target_digest=md5((to_jsonb(u) || jsonb_build_object('profile', to_jsonb(p)))::text)`)
  if (reconciliation.rows[0].total !== sources.length)
    throw new Error('Post-apply reconciliation failed')
  return report
}
