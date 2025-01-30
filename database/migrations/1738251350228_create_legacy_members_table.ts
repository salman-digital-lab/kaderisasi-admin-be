import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'legacy_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name')
      table.string('gender')
      table.string('email')
      table.string('phone')
      table.string('line_id')
      table.string('intake_year')
      table.string('password')
      table.float('ssc')
      table.float('lmd')
      table.float('spectra')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}