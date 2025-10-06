import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'custom_forms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('post_submission_info').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('post_submission_info')
    })
  }
}