import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('place_of_birth')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('place_of_birth', 100).nullable()
    })
  }
}
