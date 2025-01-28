import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').references('public_users.id').onDelete('CASCADE')
      table.string('name').notNullable()
      table.string('gender', 1)
      table.string('personal_id', 50)

      table.string('whatsapp', 35)
      table.string('line', 50)
      table.string('instagram', 50)
      table.string('tiktok', 50)
      table.string('linkedin', 50)

      table.integer('province_id', 2).references('provinces.id')
      table.integer('city_id', 4).references('cities.id')

      table.integer('university_id', 4).references('universities.id')
      table.string('major', 50)
      table.integer('intake_year')
      table.integer('level').defaultTo(0)

      table.timestamp('created_at', { useTz: true })
      table.timestamp('updated_at', { useTz: true })
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
