import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import { cleanupPublicEmails } from '#services/public_email_cleanup'

export default class NormalizePublicEmails extends BaseCommand {
  static commandName = 'public-users:normalize-emails'
  static description =
    'Keep lower-ID duplicate accounts, preserve registration history, and lowercase emails'
  static options: CommandOptions = { startApp: true }
  @flags.boolean() declare apply: boolean
  @flags.boolean() declare discardInvalidLegacyEmails: boolean
  @flags.string({ required: true }) declare environment: string
  @flags.string({ required: true }) declare report: string
  @flags.string() declare backup: string

  async run(): Promise<void> {
    if (
      !['prod', 'test'].includes(this.environment) ||
      process.env.LEGACY_MEMBER_ENVIRONMENT !== this.environment
    )
      throw new Error('Explicit environment via maintenance.mjs required')
    let fingerprint: Record<string, string> | undefined
    if (this.apply) {
      if (!this.backup) throw new Error('Verified backup manifest required')
      const backup = JSON.parse(await readFile(this.backup, 'utf8')) as {
        environment: string
        path: string
        sha256: string
        restoreVerified: boolean
        fingerprint: Record<string, string>
      }
      if (backup.environment !== this.environment || !backup.restoreVerified)
        throw new Error('Backup environment or restore verification mismatch')
      if (
        createHash('sha256')
          .update(await readFile(backup.path))
          .digest('hex') !== backup.sha256
      )
        throw new Error('Backup checksum mismatch')
      fingerprint = backup.fingerprint
    }
    const report = await db.transaction(async (trx) => {
      const result = await cleanupPublicEmails(
        trx,
        Boolean(this.apply),
        fingerprint,
        Boolean(this.discardInvalidLegacyEmails)
      )
      await writeFile(this.report, JSON.stringify(result, null, 2), { mode: 0o600, flag: 'wx' })
      return result
    })
    this.logger.info(
      JSON.stringify({
        applied: report.applied,
        duplicates: report.duplicates.length,
        lowercaseCount: report.lowercaseCount,
        registrationsPreserved: report.transferredRegistrations,
        discardedLegacyRecords: report.discardedLegacyIds.length,
        blockers: report.blockers,
        report: this.report,
      })
    )
    if (report.blockers.length) this.exitCode = 1
  }
}
