import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'clubs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.text('description')
      table.string('short_description', 200).nullable()
      table.string('logo').nullable()
      table.jsonb('media').defaultTo(JSON.stringify({ items: [] }))
      table.date('start_period').nullable()
      table.date('end_period').nullable()
      table.boolean('is_show').defaultTo(true)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}