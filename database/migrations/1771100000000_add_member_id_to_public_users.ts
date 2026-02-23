import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'public_users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('member_id').nullable().unique()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('member_id')
    })
  }
}
