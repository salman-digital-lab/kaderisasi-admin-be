import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'issued_certificates'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('certificate_code').notNullable().unique()
      table
        .integer('registration_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('activity_registrations')
        .onDelete('CASCADE')
      table.integer('activity_id').unsigned().notNullable().references('id').inTable('activities')
      table.integer('user_id').unsigned().nullable().references('id').inTable('public_users')
      table
        .integer('template_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('certificate_templates')
      table.jsonb('template_snapshot').notNullable()
      table.jsonb('participant_snapshot').notNullable()
      table.integer('issued_by').unsigned().nullable().references('id').inTable('admin_users')
      table.timestamp('issued_at').notNullable()
      table.timestamp('revoked_at').nullable()
      table.text('revoked_reason').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['activity_id'])
      table.index(['registration_id'])
      table.index(['template_id'])
      table.unique(['registration_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
