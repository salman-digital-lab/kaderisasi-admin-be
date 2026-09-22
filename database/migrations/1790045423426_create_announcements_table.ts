import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    this.schema.createTable('announcements', (table) => {
      table.increments('id')
      table.string('title', 160).notNullable()
      table.text('body').notNullable()
      table.string('link_label', 100).nullable()
      table.text('link_url').nullable()
      table.jsonb('audience').notNullable()
      table.string('state', 20).notNullable().defaultTo('draft')
      table.integer('version').notNullable().defaultTo(1)
      table.integer('author_id').nullable().references('admin_users.id').onDelete('SET NULL')
      table.integer('publisher_id').nullable().references('admin_users.id').onDelete('SET NULL')
      table.timestamp('published_at', { useTz: true }).nullable()
      table.timestamp('withdrawn_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.integer('recipient_count').notNullable().defaultTo(0)
      table.check("state in ('draft', 'published', 'withdrawn')")
      table.check('length(trim(title)) > 0 AND length(trim(body)) BETWEEN 1 AND 10000')
      table.check('(link_label IS NULL) = (link_url IS NULL)')
    })
    this.schema.createTable('announcement_recipients', (table) => {
      table.increments('id')
      table
        .integer('announcement_id')
        .notNullable()
        .references('announcements.id')
        .onDelete('CASCADE')
      table.integer('admin_user_id').nullable().references('admin_users.id').onDelete('CASCADE')
      table.integer('public_user_id').nullable().references('public_users.id').onDelete('CASCADE')
      table.timestamp('read_at', { useTz: true }).nullable()
      table.check('(admin_user_id IS NOT NULL) <> (public_user_id IS NOT NULL)')
      table.unique(['announcement_id', 'admin_user_id'])
      table.unique(['announcement_id', 'public_user_id'])
      table.index(['admin_user_id', 'read_at', 'id'])
      table.index(['public_user_id', 'read_at', 'id'])
    })
  }

  async down(): Promise<void> {
    this.schema.dropTable('announcement_recipients')
    this.schema.dropTable('announcements')
  }
}
