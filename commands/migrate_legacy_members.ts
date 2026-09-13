import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { open, readFile, rename, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import db from '@adonisjs/lucid/services/db'
import { migrateLegacyMembers, parseResolutions } from '#services/legacy_member_migration'

export default class MigrateLegacyMembers extends BaseCommand {
  static commandName = 'legacy-members:migrate'
  static description = 'Reconcile legacy members; read-only unless --apply is supplied'
  static options: CommandOptions = { startApp: true }

  @flags.boolean() declare apply: boolean
  @flags.string({ required: true }) declare environment: string
  @flags.string({ required: true }) declare report: string
  @flags.string() declare resolutions: string

  async run(): Promise<void> {
    if (
      !['prod', 'test'].includes(this.environment) ||
      process.env.LEGACY_MEMBER_ENVIRONMENT !== this.environment
    ) {
      throw new Error(
        'Use scripts/maintenance.mjs with an explicit --environment=prod or --environment=test'
      )
    }
    const resolutions = this.resolutions
      ? parseResolutions(JSON.parse(await readFile(this.resolutions, 'utf8')))
      : { members: {} }
    const path = resolve(this.report)
    const temporary = `${path}.${randomUUID()}.tmp`
    const file = await open(temporary, 'wx', 0o600)
    try {
      const report = await db.transaction(async (trx) => {
        const result = await migrateLegacyMembers(trx, Boolean(this.apply), resolutions)
        await file.writeFile(JSON.stringify(result, null, 2))
        await file.sync()
        await file.close()
        await rename(temporary, path)
        return result
      })
      this.logger.info(
        JSON.stringify({
          environment: this.environment,
          mode: report.mode,
          sourceCount: report.sourceCount,
          alreadyMigrated: report.alreadyMigrated,
          createUsers: report.createUsers,
          mergeUsers: report.mergeUsers,
          blockers: report.blockers.length,
          conflicts: report.conflicts.length,
          report: path,
        })
      )
      if (report.blockers.length) this.exitCode = 1
    } catch (error) {
      await file.close().catch(() => {})
      await unlink(temporary).catch(() => {})
      this.logger.error(
        'Migration did not commit; any report is provisional until a successful rerun reconciles it'
      )
      throw error
    }
  }
}
