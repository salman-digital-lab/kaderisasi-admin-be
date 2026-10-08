import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'lifetime_leaderboards'

  async up(): Promise<void> {
    this.schema.dropTableIfExists(this.tableName)
  }

  // Restores the empty table structure only; deleted rows cannot be recovered.
  async down(): Promise<void> {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').references('public_users.id').onDelete('CASCADE')
      table.integer('score_academic')
      table.integer('score_competition')
      table.integer('score_organizational')
      table.integer('score')

      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['user_id'], 'idx_lifetime_lb_user_id')
      table.index(['score'], 'idx_lifetime_lb_score')
    })
  }
}
