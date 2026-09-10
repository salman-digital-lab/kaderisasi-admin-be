import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import db from '@adonisjs/lucid/services/db'
import { ADMIN_ROLE_CODES } from '#constants/admin_roles'
import env from '#start/env'
import { parseBootstrapEmails } from '#services/admin_rbac_seed_service'

export default class RbacPreflight extends BaseCommand {
  static commandName = 'rbac:preflight'
  static description = 'Read-only preflight for admin identities and the feature-based RBAC seed'
  static options: CommandOptions = { startApp: true }

  async run(): Promise<void> {
    const columns = await db
      .from('information_schema.columns')
      .whereRaw('table_schema = current_schema()')
      .where('table_name', 'admin_users')
      .select('column_name')
    const columnNames = new Set<string>(columns.map((column) => column.column_name))
    const rbacReady = columnNames.has('role_code')
    const bootstrapEmails = parseBootstrapEmails(env.get('ADMIN_BOOTSTRAP_EMAILS', ''))
    const inactiveAccounts = await db
      .from('admin_users')
      .where('is_active', false)
      .select(db.raw('LOWER(TRIM(email)) AS email'))
    const inactiveEmails = new Set<string>(inactiveAccounts.map((account) => account.email))
    const invalidBootstrapEmails = bootstrapEmails.filter((email) => inactiveEmails.has(email))
    const duplicateEmails = await db
      .from('admin_users')
      .select(db.raw('LOWER(TRIM(email)) AS normalized_email'))
      .count('* as total')
      .groupByRaw('LOWER(TRIM(email))')
      .havingRaw('COUNT(*) > 1')
    const invalidEmails = await db
      .from('admin_users')
      .whereNull('email')
      .orWhereRaw("TRIM(email) = ''")
      .select('id')
    const activeSuperAdmins = rbacReady
      ? await db
          .from('admin_users')
          .where('role_code', 'super_admin')
          .where('is_active', true)
          .select('id')
      : []
    const roleDistribution = rbacReady
      ? await db
          .from('admin_users')
          .select('role_code')
          .count('* as total')
          .groupBy('role_code')
          .orderBy('role_code')
      : []
    const unknownRoles = rbacReady
      ? await db
          .from('admin_users')
          .whereNotNull('role_code')
          .whereNotIn('role_code', [...ADMIN_ROLE_CODES])
          .select('id', 'role_code')
      : []
    const blockers = [
      ...(unknownRoles.length ? ['UNKNOWN_ROLE_CODES'] : []),
      ...(!columnNames.has('role') && !rbacReady ? ['UNEXPECTED_ADMIN_SCHEMA'] : []),
      ...(duplicateEmails.length ? ['DUPLICATE_NORMALIZED_EMAILS'] : []),
      ...(invalidEmails.length ? ['EMPTY_ADMIN_EMAILS'] : []),
      ...(invalidBootstrapEmails.length ? ['BOOTSTRAP_ADMIN_IS_INACTIVE'] : []),
      ...(!activeSuperAdmins.length && !bootstrapEmails.length
        ? ['ADMIN_BOOTSTRAP_EMAILS_REQUIRED']
        : []),
    ]
    this.logger.info(
      JSON.stringify(
        {
          rbac_schema_present: rbacReady,
          bootstrap_account_count: bootstrapEmails.length,
          invalid_bootstrap_emails: invalidBootstrapEmails,
          duplicate_normalized_emails: duplicateEmails,
          invalid_email_accounts: invalidEmails,
          role_distribution: roleDistribution,
          unknown_role_accounts: unknownRoles,
          active_super_admin_count: activeSuperAdmins.length,
          blockers,
        },
        null,
        2
      )
    )
    if (blockers.length) {
      this.logger.error(`RBAC preflight blocked: ${blockers.join(', ')}`)
      this.exitCode = 1
    } else {
      this.logger.success('RBAC preflight passed')
    }
  }
}
