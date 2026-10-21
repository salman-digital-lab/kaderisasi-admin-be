import { BaseSchema } from '@adonisjs/lucid/schema'

// Certificate groups were never used; drop the column added by 1789050000000.
export default class extends BaseSchema {
  protected tableName = 'activity_registrations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('certificate_group')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('certificate_group', 100).nullable()
    })
  }
}
