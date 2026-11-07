import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Self-service email changes by members (Go web API). A request is open until
 * it is used or cancelled; a member has at most one open request.
 *
 * - Members without a password first confirm a 6-digit code sent to their
 *   current email (code_*); code_verified_at marks that step done.
 * - The confirmation link sent to the new email carries a random token; only
 *   its SHA-256 hash is stored (token_hash).
 */
export default class extends BaseSchema {
  protected tableName = 'public_user_email_changes'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').notNullable().references('public_users.id').onDelete('CASCADE')
      table.string('old_email', 255).notNullable()
      table.string('new_email', 255).notNullable()
      table.string('code_hash', 64).nullable()
      table.integer('code_attempts').notNullable().defaultTo(0)
      table.timestamp('code_expires_at', { useTz: true }).nullable()
      table.timestamp('code_verified_at', { useTz: true }).nullable()
      table.string('token_hash', 64).nullable().unique()
      table.timestamp('token_expires_at', { useTz: true }).nullable()
      table.timestamp('used_at', { useTz: true }).nullable()
      table.timestamp('cancelled_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.check('code_attempts >= 0', [], 'public_user_email_changes_code_attempts_check')
    })
    this.schema.raw(
      `CREATE UNIQUE INDEX public_user_email_changes_open_user_unique
       ON ${this.tableName} (user_id) WHERE used_at IS NULL AND cancelled_at IS NULL`
    )
  }

  async down(): Promise<void> {
    this.schema.dropTableIfExists(this.tableName)
  }
}
