import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName1 = 'achievements'
  protected tableName2 = 'monthly_leaderboards'
  protected tableName3 = 'lifetime_leaderboards'

  async up() {
    this.schema.createTable(this.tableName1, (table) => {
      table.increments('id')
      table.integer('user_id').references('public_users.id').onDelete('CASCADE')

      table.string('name')
      table.text('description')
      table.date('achievement_date')
      table.integer('type')
      table.integer('score')
      table.string('proof')
      table.integer('status').defaultTo(0)

      table.integer('approver_id').references('admin_users.id').onDelete('CASCADE')
      table.date('approved_at')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.createTable(this.tableName2, (table) => {
      table.increments('id')
      table.integer('user_id').references('public_users.id').onDelete('CASCADE')
      table.date('month')

      table.integer('score_academic')
      table.integer('score_competency')
      table.integer('score_organizational')
      table.integer('score')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.createTable(this.tableName3, (table) => {
      table.increments('id')
      table.integer('user_id').references('public_users.id').onDelete('CASCADE')
      table.integer('score_academic')
      table.integer('score_competency')
      table.integer('score_organizational')
      table.integer('score')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName1)
    this.schema.dropTable(this.tableName2)
    this.schema.dropTable(this.tableName3)
  }
}
