import { BaseSchema } from '@adonisjs/lucid/schema'
import env from '#start/env'
import { parseBootstrapEmails, seedAdminRbac } from '#services/admin_rbac_seed_service'

export default class extends BaseSchema {
  async up(): Promise<void> {
    this.defer(async (db) => {
      await seedAdminRbac(db, parseBootstrapEmails(env.get('ADMIN_BOOTSTRAP_EMAILS', '')))
      await db.rawQuery('ALTER TABLE admin_users DROP COLUMN role')
    })
  }

  async down(): Promise<void> {
    throw new Error('RBAC_RESET_IS_FORWARD_ONLY_RESTORE_A_VERIFIED_DATABASE_BACKUP')
  }
}
