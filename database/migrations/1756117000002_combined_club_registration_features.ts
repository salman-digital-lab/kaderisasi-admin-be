import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'clubs'

  async up() {
    // Create club_registrations table
    this.schema.createTable('club_registrations', (table) => {
      table.increments('id')
      table.integer('club_id').references('clubs.id').onDelete('CASCADE')
      table.integer('member_id').references('public_users.id').onDelete('CASCADE')
      table.string('status', 50).defaultTo('PENDING')
      table.jsonb('additional_data').defaultTo('{}')

      table.timestamp('created_at')
      table.timestamp('updated_at')

      // Add unique constraint to prevent duplicate registrations
      table.unique(['club_id', 'member_id'])
    })

    // Alter clubs table to add all registration-related fields
    this.schema.alterTable(this.tableName, (table) => {
      // Add registration_info field
      table.jsonb('registration_info').defaultTo('{"registration_info": "", "after_registration_info": ""}')
      
      // Add registration control fields
      table.boolean('is_registration_open').defaultTo(false)
      table.date('registration_end_date').nullable()
    })
  }

  async down() {
    // Drop club_registrations table
    this.schema.dropTable('club_registrations')

    // Remove all registration-related fields from clubs table
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('registration_info')
      table.dropColumn('is_registration_open')
      table.dropColumn('registration_end_date')
    })
  }
}
