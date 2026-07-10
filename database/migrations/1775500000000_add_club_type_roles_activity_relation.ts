import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('clubs', (table) => {
      table.string('club_type', 50).notNullable().defaultTo('UKM')
      table.index(['club_type'], 'idx_clubs_club_type')
    })

    this.schema.createTable('club_member_roles', (table) => {
      table.increments('id')
      table
        .integer('club_registration_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('club_registrations')
        .onDelete('CASCADE')
      table.string('role_name', 150).notNullable()
      table.date('start_date').nullable()
      table.date('end_date').nullable()
      table.boolean('is_primary').notNullable().defaultTo(false)
      table.integer('sort_order').notNullable().defaultTo(0)

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['club_registration_id'], 'idx_club_member_roles_registration')
      table.index(['role_name'], 'idx_club_member_roles_name')
    })

    this.schema.alterTable('activities', (table) => {
      table
        .integer('club_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('clubs')
        .onDelete('SET NULL')
      table.index(['club_id'], 'idx_activities_club')
    })
  }

  async down() {
    this.schema.alterTable('activities', (table) => {
      table.dropIndex(['club_id'], 'idx_activities_club')
      table.dropColumn('club_id')
    })

    this.schema.dropTable('club_member_roles')

    this.schema.alterTable('clubs', (table) => {
      table.dropIndex(['club_type'], 'idx_clubs_club_type')
      table.dropColumn('club_type')
    })
  }
}
