import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up(): Promise<void> {
    this.schema.alterTable('admin_users', (table) => {
      table.specificType('additional_role_codes', 'text[]').notNullable().defaultTo('{}')
    })
  }

  async down(): Promise<void> {
    this.schema.alterTable('admin_users', (table) => {
      table.dropColumn('additional_role_codes')
    })
  }
}
