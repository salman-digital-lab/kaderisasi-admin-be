import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'activity_registrations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').references('public_users.id').onDelete('CASCADE')
      table.integer('activity_id').references('activities.id').onDelete('CASCADE')
      table.string('status', 50)
      table.jsonb('questionnaire_answer').defaultTo({})

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
