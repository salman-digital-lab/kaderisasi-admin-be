import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('admin_users', (table) => {
      table.string('normalized_email').nullable()
      table.string('role_code', 100).nullable().index()
    })

    this.schema.createTable('admin_auth_identities', (table) => {
      table.increments('id')
      table
        .integer('admin_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('CASCADE')
      table.string('provider', 40).notNullable()
      table.string('provider_subject', 255).notNullable()
      table.string('email', 255).notNullable()
      table.timestamp('last_used_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
      table.unique(['provider', 'provider_subject'])
      table.unique(['provider', 'admin_user_id'])
    })

    this.schema.createTable('admin_refresh_tokens', (table) => {
      table.increments('id')
      table.uuid('family_id').notNullable()
      table
        .integer('admin_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('CASCADE')
      table.string('token_hash', 64).notNullable().unique()
      table
        .integer('parent_token_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('admin_refresh_tokens')
        .onDelete('SET NULL')
      table
        .integer('replaced_by_token_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('admin_refresh_tokens')
        .onDelete('SET NULL')
      table.string('user_agent', 500).nullable()
      table.string('ip_address', 100).nullable()
      table.timestamp('expires_at', { useTz: true }).notNullable()
      table.timestamp('last_used_at', { useTz: true }).nullable()
      table.timestamp('revoked_at', { useTz: true }).nullable()
      table.string('revocation_reason', 100).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.index(['admin_user_id', 'family_id'])
      table.index(['expires_at'])
    })

    this.schema.createTable('tickets', (table) => {
      table.increments('id')
      table.string('number', 40).notNullable().unique()
      table.string('status', 30).notNullable().defaultTo('open')
      table.string('resolution', 30).nullable()
      table
        .integer('requester_admin_user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('RESTRICT')
      table.string('requested_role_code', 100).notNullable()
      table.text('reason').notNullable()
      table.text('rejection_reason').nullable()
      table
        .integer('resolved_by_admin_user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('admin_users')
        .onDelete('SET NULL')
      table.timestamp('resolved_at', { useTz: true }).nullable()
      table.timestamp('cancelled_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
      table.index(['requester_admin_user_id', 'status'])
      table.index(['requested_role_code', 'status'])
    })

    this.defer(async (db) => {
      await db.rawQuery(
        `UPDATE admin_users SET email = LOWER(TRIM(email)), normalized_email = LOWER(TRIM(email))`
      )
      await db.rawQuery(`ALTER TABLE admin_users ALTER COLUMN normalized_email SET NOT NULL`)
      await db.rawQuery(`ALTER TABLE admin_users ALTER COLUMN password DROP NOT NULL`)
      await db.rawQuery(
        `CREATE UNIQUE INDEX admin_users_normalized_email_unique ON admin_users (normalized_email)`
      )
      await db.rawQuery(
        `CREATE UNIQUE INDEX tickets_one_open_role_request ON tickets (requester_admin_user_id, requested_role_code) WHERE status = 'open'`
      )
      await db.rawQuery(
        `ALTER TABLE tickets ADD CONSTRAINT tickets_role_request_status CHECK (status IN ('open', 'resolved', 'cancelled'))`
      )
    })
  }

  async down() {
    this.schema.dropTable('tickets')
    this.schema.dropTable('admin_refresh_tokens')
    this.schema.dropTable('admin_auth_identities')
    this.schema.alterTable('admin_users', (table) => {
      table.dropColumn('role_code')
      table.dropColumn('normalized_email')
    })
    this.defer(async (db) => {
      await db.rawQuery(`ALTER TABLE admin_users ALTER COLUMN password SET NOT NULL`)
    })
  }
}
