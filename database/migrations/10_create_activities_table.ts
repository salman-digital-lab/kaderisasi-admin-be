import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'activities'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('slug').unique().notNullable()
      table.text('description')

      table.date('activity_start')
      table.date('activity_end')
      table.date('registration_start')
      table.date('registration_end')
      table.date('selection_start')
      table.date('selection_end')

      table.integer('activity_type')
      table.integer('activity_category')

      table.jsonb('additional_config').defaultTo({
        custom_selection_status: [],
        mandatory_profile_data: [],
        additional_questionnaire: [],
        images: [],
      })

      table.integer('minimum_level').defaultTo(0)
      table.boolean('is_published').defaultTo(false)

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
