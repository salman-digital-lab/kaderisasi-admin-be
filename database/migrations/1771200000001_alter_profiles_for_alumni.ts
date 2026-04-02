import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('place_of_birth', 100).nullable()
      table.integer('origin_province_id').nullable().references('provinces.id')
      table.integer('origin_city_id').nullable().references('cities.id')
      table.string('country', 100).nullable()
      table.jsonb('education_history').defaultTo('[]')
      table.jsonb('work_history').defaultTo('[]')
      table.jsonb('extra_data').defaultTo('{}')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('place_of_birth')
      table.dropColumn('origin_province_id')
      table.dropColumn('origin_city_id')
      table.dropColumn('country')
      table.dropColumn('education_history')
      table.dropColumn('work_history')
      table.dropColumn('extra_data')
    })
  }
}
