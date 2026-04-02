import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'public_users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('email').nullable().alter()
      table.string('password').nullable().alter()
      table.string('account_status', 20).notNullable().defaultTo('no_account')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('email').notNullable().alter()
      table.string('password').notNullable().alter()
      table.dropColumn('account_status')
    })
  }
}
