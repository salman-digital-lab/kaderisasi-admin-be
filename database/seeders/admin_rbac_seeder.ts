import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { parseBootstrapEmails, seedAdminRbac } from '#services/admin_rbac_seed_service'

export default class AdminRbacSeeder extends BaseSeeder {
  async run(): Promise<void> {
    await db.transaction(async (trx) => {
      await seedAdminRbac(trx, parseBootstrapEmails(env.get('ADMIN_BOOTSTRAP_EMAILS', '')))
    })
  }
}
