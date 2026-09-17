import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'custom_form_responses'

  async up() {
    this.schema.createTable('custom_form_sessions', (table) => {
      table.uuid('id').primary()
      table
        .integer('form_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('custom_forms')
        .onDelete('CASCADE')
      table.string('token_hash', 64).notNullable().unique()
      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('public_users')
        .onDelete('SET NULL')
      table.string('schema_hash', 64).notNullable()
      table.timestamp('expires_at', { useTz: true }).notNullable().index()
      table.timestamp('completed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table
        .integer('form_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('custom_forms')
        .onDelete('RESTRICT')
        .index()
      table
        .uuid('session_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('custom_form_sessions')
        .onDelete('RESTRICT')
      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('public_users')
        .onDelete('SET NULL')
      table.jsonb('form_snapshot').notNullable()
      table.jsonb('answers').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
    this.schema.createTable('custom_form_attachments', (table) => {
      table.uuid('id').primary()
      table
        .uuid('session_id')
        .notNullable()
        .references('id')
        .inTable('custom_form_sessions')
        .onDelete('RESTRICT')
        .index()
      table.string('field_key', 255).notNullable()
      table.string('storage_key', 512).notNullable().unique()
      table.string('original_name', 255).notNullable()
      table.string('download_name', 255).notNullable()
      table.string('mime_type', 100).notNullable()
      table.integer('size_bytes').notNullable()
      table.integer('source_size_bytes').notNullable()
      table.integer('width').nullable()
      table.integer('height').nullable()
      table.timestamp('claimed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now()).index()
    })
  }

  async down() {
    this.schema.dropTable('custom_form_attachments')
    this.schema.dropTable(this.tableName)
    this.schema.dropTable('custom_form_sessions')
  }
}
