import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'activity_registrations'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('certificate_group', 100).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('certificate_group')
    })
  }
}
