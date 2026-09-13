import { BaseSchema } from '@adonisjs/lucid/schema'
import { readFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'

export default class extends BaseSchema {
  async up(): Promise<void> {
    const evidencePath = process.env.LEGACY_MEMBER_CUTOVER_FILE
    if (!evidencePath || !['prod', 'test'].includes(process.env.LEGACY_MEMBER_ENVIRONMENT || '')) {
      throw new Error('Explicit environment and LEGACY_MEMBER_CUTOVER_FILE are required')
    }
    const evidence = JSON.parse(await readFile(evidencePath, 'utf8')) as {
      environment: string
      schema: string
      backupPath: string
      backupSha256: string
      restoreVerified: boolean
      deploymentRef: string
      authenticationVerified: boolean
      writesPaused: boolean
      verifiedAt: string
      sourceCount: number
    }
    const age = Date.now() - Date.parse(evidence.verifiedAt)
    if (
      evidence.environment !== process.env.LEGACY_MEMBER_ENVIRONMENT ||
      !evidence.restoreVerified ||
      !evidence.authenticationVerified ||
      !evidence.writesPaused ||
      !evidence.deploymentRef ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > 3_600_000 ||
      !Number.isSafeInteger(evidence.sourceCount)
    ) {
      throw new Error(
        'Fresh backup, deployment, authentication, and paused-write evidence required'
      )
    }
    const digest = createHash('sha256')
    for await (const chunk of createReadStream(evidence.backupPath)) digest.update(chunk)
    if (digest.digest('hex') !== evidence.backupSha256) throw new Error('Backup checksum mismatch')
    this.defer(async (db) => {
      await db.rawQuery("SET LOCAL lock_timeout = '10s'")
      await db.rawQuery("SELECT pg_advisory_xact_lock(hashtext('legacy-member-migration'))")
      await db.rawQuery(
        'LOCK TABLE legacy_members, public_users, profiles, legacy_member_migrations IN SHARE ROW EXCLUSIVE MODE'
      )
      const result = await db.rawQuery(`SELECT current_schema() AS schema,
        (SELECT count(*)::int FROM legacy_members) AS source_count,
        (SELECT count(*)::int FROM legacy_member_migrations) AS mapped_count,
        (SELECT count(*)::int FROM legacy_members l
          LEFT JOIN legacy_member_migrations m ON m.legacy_id=l.id
          LEFT JOIN public_users u ON u.id=m.public_user_id
          LEFT JOIN profiles p ON p.id=m.profile_id AND p.user_id=u.id
          WHERE m.legacy_id IS NULL OR u.id IS NULL OR p.id IS NULL
            OR m.source_digest <> md5(to_jsonb(l)::text)
            OR m.target_digest <> md5((to_jsonb(u) || jsonb_build_object('profile', to_jsonb(p)))::text)
        ) AS mismatches`)
      const row = result.rows[0]
      if (
        row.schema !== evidence.schema ||
        row.source_count !== evidence.sourceCount ||
        row.mapped_count !== row.source_count ||
        row.mismatches !== 0
      )
        throw new Error('Legacy member reconciliation failed; table retained')
      await db.rawQuery('DROP TABLE legacy_members')
      for (const table of ['public_users', 'profiles']) {
        await db.rawQuery(`DROP TRIGGER IF EXISTS legacy_member_write_guard ON ${table}`)
      }
      await db.rawQuery('DROP FUNCTION IF EXISTS legacy_member_write_guard()')
    })
  }

  async down(): Promise<void> {
    throw new Error('Legacy member retirement is forward-only; restore the verified backup')
  }
}
