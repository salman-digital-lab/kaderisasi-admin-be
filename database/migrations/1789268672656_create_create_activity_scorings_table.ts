import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'activity_scoring_rubrics'

  async up(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('activity_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('activities')
        .onDelete('CASCADE')
      table.jsonb('definition').notNullable()
      table.integer('revision').notNullable().defaultTo(1)
      table.timestamp('locked_at', { useTz: true }).nullable()
      table.integer('updated_by').notNullable().references('id').inTable('admin_users')
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
    this.schema.alterTable('activity_registrations', (table) => {
      table.jsonb('scoring_data').nullable()
    })
    this.schema.createTable('activity_scoring_publications', (table) => {
      table.increments('id')
      table
        .integer('activity_id')
        .notNullable()
        .references('id')
        .inTable('activities')
        .onDelete('RESTRICT')
      table
        .integer('registration_id')
        .notNullable()
        .references('id')
        .inTable('activity_registrations')
        .onDelete('RESTRICT')
      table.integer('revision').notNullable()
      table.string('action', 16).notNullable()
      table.jsonb('snapshot').nullable()
      table.integer('actor_id').notNullable().references('id').inTable('admin_users')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.unique(['registration_id', 'revision'])
      table.index(['activity_id', 'registration_id'])
    })
    this.schema.raw(
      "ALTER TABLE activity_scoring_publications ADD CONSTRAINT scoring_publication_action CHECK ((action = 'publish' AND snapshot IS NOT NULL) OR (action = 'withdraw' AND snapshot IS NULL))"
    )
    this.schema.raw(
      "ALTER TABLE activity_registrations ADD CONSTRAINT scoring_data_object CHECK (scoring_data IS NULL OR (jsonb_typeof(scoring_data) = 'object' AND scoring_data->>'schema_version' = '1'))"
    )
  }

  async down(): Promise<void> {
    this.schema.dropTable('activity_scoring_publications')
    this.schema.alterTable('activity_registrations', (table) => table.dropColumn('scoring_data'))
    this.schema.dropTable(this.tableName)
  }
}
