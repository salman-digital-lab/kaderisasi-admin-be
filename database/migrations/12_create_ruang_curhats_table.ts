import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ruang_curhats'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').references('public_users.id').onDelete('CASCADE')
      table.integer('problem_ownership', 2)
      table.string('owner_name', 50)
      table.string('problem_category', 50)
      table.text('problem_description')

      table.string('handling_technic')
      table.string('counselor_gender')
      table.integer('counselor_id').references('admin_users.id').onDelete('CASCADE')

      table.integer('status', 2).defaultTo(0)
      table.text('additional_notes')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
