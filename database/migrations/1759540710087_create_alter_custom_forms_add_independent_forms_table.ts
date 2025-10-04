import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'custom_forms'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Drop the existing enum constraint and recreate it with the new value
      table.dropColumn('feature_type')
    })

    this.schema.alterTable(this.tableName, (table) => {
      // Add the feature_type column back with the new enum values
      table.enum('feature_type', ['activity_registration', 'club_registration', 'independent_form'])
      
      // Make feature_id nullable
      table.integer('feature_id').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Revert feature_type back to the original enum
      table.dropColumn('feature_type')
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.enum('feature_type', ['activity_registration', 'club_registration'])
      
      // Revert feature_id to not nullable
      table.integer('feature_id').notNullable().alter()
    })
  }
}