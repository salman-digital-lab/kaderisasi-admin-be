import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'activity_registrations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('user_id').nullable().alter()
      table.jsonb('guest_data').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('guest_data')
      table.integer('user_id').notNullable().alter()
    })
  }
}
