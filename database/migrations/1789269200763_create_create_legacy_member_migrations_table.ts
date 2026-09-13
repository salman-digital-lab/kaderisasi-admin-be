import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    this.schema.createTable('legacy_member_migrations', (table) => {
      table.bigInteger('legacy_id').primary()
      table.integer('public_user_id').notNullable()
      table.integer('profile_id').notNullable()
      table.string('source_digest', 32).notNullable()
      table.string('target_digest', 32).notNullable()
      table.jsonb('source_data').notNullable()
      table.jsonb('resolution').notNullable()
      table.timestamp('migrated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down(): Promise<void> {
    throw new Error('Legacy member reconciliation is forward-only; restore from backup if needed')
  }
}
