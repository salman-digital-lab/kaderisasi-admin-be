import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'calendar_events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('title', 255).notNullable()
      table.text('description').nullable()
      table.string('location', 500).nullable()
      table.timestamp('starts_at', { useTz: true }).notNullable()
      table.timestamp('ends_at', { useTz: true }).notNullable()
      table.boolean('all_day').notNullable().defaultTo(false)
      table.integer('activity_id').nullable().references('activities.id').onDelete('SET NULL')
      table.check('ends_at > starts_at')
      table.check('length(trim(title)) > 0')
      table.index(['starts_at'])
      table.index(['ends_at'])
      table.index(['activity_id'])

      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
