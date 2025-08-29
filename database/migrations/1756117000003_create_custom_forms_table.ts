import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'custom_forms'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('form_name').notNullable()
      table.text('form_description')
      table.enum('feature_type', ['activity_registration', 'club_registration'])
      table.integer('feature_id')
      table.jsonb('form_schema').defaultTo('{}')
      table.boolean('is_active').defaultTo(true)
      table.timestamp('created_at')
      table.timestamp('updated_at')

      // Add indexes for better query performance
      table.index(['feature_type', 'feature_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
